import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.ts';
import {
  admins,
  users,
  instruments,
  reservations,
  reservationSeries,
  notifications,
  hardLimits,
  paymentSettings,
  trustedStatusAuditLog,
  messages,
  sessions,
} from '../db/schema.ts';
import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { validateSession } from './session-manager.ts';
import { normalizePhoneNumber, normalizeEmail, isValidEmail } from '../lib/auth-helpers.ts';
import {
  adminApproveReservation,
  adminRejectReservation,
  adminApproveSeries,
  adminRejectSeries,
  adminBulkApprove,
  adminBulkReject,
  adminBulkCancel,
  removeInstrumentWithConfirmation,
  createReservation,
  getHardLimits,
  cancelReservation,
  ensureCurrentReservationStatuses,
} from '../services/reservation-logic.ts';

const router = Router();

/**
 * Middleware: Verify Admin or Super Admin session
 */
async function requireAdminAuth(req: Request, res: Response, next: () => void) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (req.headers['x-session-token'] as string);

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required. Please sign in as an Administrator.' });
      return;
    }

    const { valid, session, error } = await validateSession(token);
    if (!valid || !session) {
      res.status(401).json({ success: false, error: error || 'Session expired. Please sign in again.' });
      return;
    }

    if (session.role !== 'admin' && session.role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Access denied. Administrator privileges required.' });
      return;
    }

    (req as any).adminSession = session;
    (req as any).adminUser = session.user;
    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Middleware: Verify Super Admin session only
 */
async function requireSuperAdminAuth(req: Request, res: Response, next: () => void) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : (req.headers['x-session-token'] as string);

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
      return;
    }

    const { valid, session, error } = await validateSession(token);
    if (!valid || !session) {
      res.status(401).json({ success: false, error: error || 'Session expired. Please sign in again.' });
      return;
    }

    if (session.role !== 'super_admin' && !session.user?.isSuperAdmin) {
      res.status(403).json({ success: false, error: 'Restricted Action. Super Administrator privileges required.' });
      return;
    }

    (req as any).adminSession = session;
    (req as any).adminUser = session.user;
    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Apply admin authentication to all routes in this router
router.use(requireAdminAuth);

/* =========================================================================
   1. DASHBOARD & STATS (Shared: Admin & Super Admin)
   ========================================================================= */

router.get('/dashboard-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure reservation statuses are up-to-date
    await ensureCurrentReservationStatuses().catch(() => {});

    const todayStr = (req.query.date as string) || new Date().toISOString().substring(0, 10);

    // 1. Total active instruments
    const instCountRes = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM instruments WHERE is_removed = false`
    );
    const totalInstruments = Number((instCountRes as any).rows?.[0]?.count || 0);

    // 2. Pending requests count
    const pendingCountRes = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM reservations WHERE status = 'pending'`
    );
    const pendingRequests = Number((pendingCountRes as any).rows?.[0]?.count || 0);

    // 3. Today's reservations count (Approved or Ongoing)
    const todayCountRes = await db.execute(sql`
      SELECT COUNT(*)::int as count 
      FROM reservations 
      WHERE status IN ('approved', 'ongoing')
        AND (lower(time_range) AT TIME ZONE 'UTC')::date = ${todayStr}::date
    `);
    const todayReservations = Number((todayCountRes as any).rows?.[0]?.count || 0);

    // 4. Total active members
    const membersCountRes = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM users WHERE is_active = true AND approval_status = 'approved'`
    );
    const activeUsers = Number((membersCountRes as any).rows?.[0]?.count || 0);

    // 5. Total pending user registration approvals
    const pendingUsersRes = await db.execute(
      sql`SELECT COUNT(*)::int as count FROM users WHERE approval_status = 'pending'`
    );
    const pendingUserApprovals = Number((pendingUsersRes as any).rows?.[0]?.count || 0);

    res.json({
      success: true,
      stats: {
        totalInstruments,
        pendingRequests,
        todayReservations,
        activeUsers,
        pendingUserApprovals,
        todayStr,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   2. RESERVATIONS MANAGEMENT & REVIEW (Shared)
   ========================================================================= */

/**
 * Get reservations list with rich filters (instrument, status, date range, user name, quick tab)
 */
router.get('/reservations', async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure reservation statuses are up-to-date
    await ensureCurrentReservationStatuses().catch(() => {});

    const { instrumentId, status, startDate, endDate, userName, search, quickTab } = req.query;

    let querySql = sql`
      SELECT 
        r.id,
        r.series_id,
        r.user_id,
        r.admin_id,
        r.instrument_id,
        r.service_name,
        r.reservation_type,
        r.fee_snapshot,
        r.status,
        r.rejection_reason,
        r.payment_screenshot_url,
        r.created_at,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        to_char(lower(r.time_range) AT TIME ZONE 'UTC', 'YYYY-MM-DD') as reservation_date,
        to_char(lower(r.time_range) AT TIME ZONE 'UTC', 'HH24:MI') as start_hhmm,
        to_char(upper(r.time_range) AT TIME ZONE 'UTC', 'HH24:MI') as end_hhmm,
        ROUND(EXTRACT(EPOCH FROM (upper(r.time_range) - lower(r.time_range))) / 3600.0, 1) as duration_hours,
        i.name as instrument_name,
        i.type as instrument_type,
        i.booking_mode,
        i.photo_url as instrument_photo_url,
        s.pattern_type as series_pattern_type,
        u.name as user_name,
        u.phone_number as user_phone,
        u.is_trusted as user_is_trusted,
        u.is_active as user_is_active,
        a.name as admin_name
      FROM reservations r
      JOIN instruments i ON r.instrument_id = i.id
      LEFT JOIN reservation_series s ON r.series_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN admins a ON r.admin_id = a.id
      WHERE 1=1
    `;

    // Filter by quick tab
    const today = new Date().toISOString().substring(0, 10);
    if (quickTab === 'today') {
      querySql = sql`${querySql} AND (lower(r.time_range) AT TIME ZONE 'UTC')::date = ${today}::date`;
    } else if (quickTab === 'pending') {
      querySql = sql`${querySql} AND r.status = 'pending'`;
    }

    if (instrumentId && typeof instrumentId === 'string' && instrumentId !== 'all') {
      querySql = sql`${querySql} AND r.instrument_id = ${instrumentId}`;
    }

    if (status && typeof status === 'string' && status !== 'all') {
      querySql = sql`${querySql} AND r.status = ${status}`;
    }

    if (startDate && typeof startDate === 'string') {
      querySql = sql`${querySql} AND (lower(r.time_range) AT TIME ZONE 'UTC')::date >= ${startDate}::date`;
    }

    if (endDate && typeof endDate === 'string') {
      querySql = sql`${querySql} AND (lower(r.time_range) AT TIME ZONE 'UTC')::date <= ${endDate}::date`;
    }

    if (userName && typeof userName === 'string' && userName.trim()) {
      const term = `%${userName.trim()}%`;
      querySql = sql`${querySql} AND (u.name ILIKE ${term} OR u.phone_number ILIKE ${term})`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      querySql = sql`${querySql} AND (
        u.name ILIKE ${term} 
        OR u.phone_number ILIKE ${term} 
        OR r.service_name ILIKE ${term} 
        OR i.name ILIKE ${term}
      )`;
    }

    querySql = sql`${querySql} ORDER BY lower(r.time_range) DESC LIMIT 200`;

    const result = await db.execute(querySql);
    res.json({ success: true, reservations: (result as any).rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Approve single reservation
 * (Force auto-rejects overlapping pending requests on the same slot)
 */
router.post('/reservations/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';
    const result = await adminApproveReservation(id, adminId);
    res.json({ success: true, reservation: result, message: 'Reservation approved successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Reject single reservation
 */
router.post('/reservations/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';
    const result = await adminRejectReservation(id, reason || 'Rejected by administrator.', adminId);
    res.json({ success: true, reservation: result, message: 'Reservation rejected.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Bulk approve reservations
 */
router.post('/reservations/bulk-approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';
    const result = await adminBulkApprove(ids, adminId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Bulk reject reservations
 */
router.post('/reservations/bulk-reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, reason } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';
    const result = await adminBulkReject(ids, reason || 'Bulk rejected by administrator.', adminId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Bulk cancel reservations
 */
router.post('/reservations/bulk-cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';
    const result = await adminBulkCancel(ids, adminId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Bulk delete reservations (hard delete with cleanup; super-admin only)
 */
router.post('/reservations/bulk-delete', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];

    if (list.length === 0) {
      res.status(400).json({ success: false, error: 'No reservation IDs provided for bulk deletion.' });
      return;
    }

    const deleted: any[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const id of list) {
      try {
        const [target] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
        if (!target) {
          errors.push({ id, error: 'Reservation not found.' });
          continue;
        }

        await db.delete(notifications).where(eq(notifications.reservationId, id));
        await db.delete(messages).where(eq(messages.reservationId, id));
        const [removed] = await db.delete(reservations).where(eq(reservations.id, id)).returning();
        deleted.push(removed);
      } catch (err: any) {
        errors.push({ id, error: err.message });
      }
    }

    res.json({ success: true, totalRequested: list.length, deletedCount: deleted.length, deleted, errors });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Approve recurring series (all occurrences)
 */
router.post('/series/:seriesId/approve-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { seriesId } = req.params;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';
    const result = await adminApproveSeries(seriesId, adminId);
    res.json({ success: true, ...result, message: 'All pending series occurrences approved.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Reject recurring series (all occurrences)
 */
router.post('/series/:seriesId/reject-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { seriesId } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';
    const result = await adminRejectSeries(seriesId, reason || 'Series rejected by administrator.', adminId);
    res.json({ success: true, ...result, message: 'All series occurrences rejected.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Get all occurrences of a series for admin inspect
 */
router.get('/series/:seriesId/occurrences', async (req: Request, res: Response): Promise<void> => {
  try {
    const { seriesId } = req.params;
    const result = await db.execute(sql`
      SELECT 
        r.id,
        r.series_id,
        r.status,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        r.service_name
      FROM reservations r
      WHERE r.series_id = ${seriesId}
      ORDER BY lower(r.time_range) ASC
    `);
    res.json({ success: true, occurrences: (result as any).rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   3. INSTRUMENT MANAGEMENT (Shared: Admin & Super Admin)
   ========================================================================= */

/**
 * Get all instruments (including removed ones with filter)
 */
router.get('/instruments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeRemoved } = req.query;
    const query = sql`
      SELECT 
        i.id,
        i.name,
        i.type,
        i.photo_url,
        i.description,
        i.outside_fee_per_day,
        i.booking_mode,
        i.is_removed,
        i.created_at,
        COUNT(r.id)::int as total_reservations,
        COUNT(CASE WHEN r.status IN ('pending', 'approved', 'ongoing') THEN 1 END)::int as active_reservations
      FROM instruments i
      LEFT JOIN reservations r ON i.id = r.instrument_id
      ${includeRemoved === 'true' ? sql`` : sql`WHERE i.is_removed = false`}
      GROUP BY i.id
      ORDER BY i.type ASC, i.name ASC
    `;

    const resDb = await db.execute(query);
    const formatted = (resDb.rows as any[]).map((inst) => ({
      id: inst.id,
      name: inst.name,
      type: inst.type,
      photoUrl: inst.photo_url,
      photo_url: inst.photo_url,
      description: inst.description,
      outsideFeePerDay: inst.outside_fee_per_day,
      outside_fee_per_day: inst.outside_fee_per_day,
      bookingMode: inst.booking_mode,
      booking_mode: inst.booking_mode,
      isRemoved: inst.is_removed,
      is_removed: inst.is_removed,
      createdAt: inst.created_at,
      created_at: inst.created_at,
      totalReservations: Number(inst.total_reservations || 0),
      total_reservations: Number(inst.total_reservations || 0),
      activeReservations: Number(inst.active_reservations || 0),
      active_reservations: Number(inst.active_reservations || 0),
    }));

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ success: true, instruments: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create a new instrument
 */
router.post('/instruments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, photoUrl, description, outsideFeePerDay, bookingMode } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Instrument name is required.' });
      return;
    }
    if (!type) {
      res.status(400).json({ success: false, error: 'Instrument type category is required.' });
      return;
    }

    const fee = outsideFeePerDay !== undefined && outsideFeePerDay !== null && outsideFeePerDay !== ''
      ? String(parseFloat(outsideFeePerDay) || 0)
      : '0.00';

    const mode = bookingMode === 'manual' ? 'manual' : 'instant';

    const inserted = await db.insert(instruments).values({
      name: name.trim(),
      type: type.trim(),
      photoUrl: photoUrl?.trim() || null,
      description: description?.trim() || null,
      outsideFeePerDay: fee,
      bookingMode: mode,
      isRemoved: false,
    }).returning();

    const inst = inserted[0];
    const formatted = {
      ...inst,
      booking_mode: inst.bookingMode,
      outside_fee_per_day: inst.outsideFeePerDay,
      photo_url: inst.photoUrl,
      is_removed: inst.isRemoved,
      created_at: inst.createdAt,
    };

    res.status(201).json({ success: true, instrument: formatted, message: 'Instrument created successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Edit an existing instrument
 */
router.put('/instruments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, photoUrl, description, outsideFeePerDay, bookingMode } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type.trim();
    if (photoUrl !== undefined) updates.photoUrl = photoUrl?.trim() || null;
    if (description !== undefined) updates.description = description?.trim() || null;
    if (outsideFeePerDay !== undefined) {
      updates.outsideFeePerDay = String(parseFloat(outsideFeePerDay) || 0);
    }
    if (bookingMode !== undefined) {
      updates.bookingMode = bookingMode === 'manual' ? 'manual' : 'instant';
    }

    const updated = await db
      .update(instruments)
      .set(updates)
      .where(eq(instruments.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ success: false, error: 'Instrument not found.' });
      return;
    }

    const inst = updated[0];
    const formatted = {
      ...inst,
      booking_mode: inst.bookingMode,
      outside_fee_per_day: inst.outsideFeePerDay,
      photo_url: inst.photoUrl,
      is_removed: inst.isRemoved,
      created_at: inst.createdAt,
    };

    res.json({ success: true, instrument: formatted, message: 'Instrument updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Upload / attach an image directly for an instrument
 */
router.post('/instruments/upload-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { image, photoUrl } = req.body;
    const finalPhoto = (image || photoUrl)?.trim();
    if (!finalPhoto) {
      res.status(400).json({ success: false, error: 'No image data or URL provided.' });
      return;
    }
    res.json({ success: true, photoUrl: finalPhoto, message: 'Image uploaded successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Update instrument photo directly
 */
router.put('/instruments/:id/photo', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { photoUrl } = req.body;
    const updated = await db
      .update(instruments)
      .set({ photoUrl: photoUrl?.trim() || null })
      .where(eq(instruments.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ success: false, error: 'Instrument not found.' });
      return;
    }

    const inst = updated[0];
    res.json({
      success: true,
      instrument: {
        ...inst,
        booking_mode: inst.bookingMode,
        outside_fee_per_day: inst.outsideFeePerDay,
        photo_url: inst.photoUrl,
        is_removed: inst.isRemoved,
        created_at: inst.createdAt,
      },
      message: 'Instrument photo updated successfully.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Force-remove an instrument with confirmation
 * (Cancels all future Approved + Pending reservations and notifies affected users)
 */
router.post('/instruments/:id/remove', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { confirmForce } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';

    const result = await removeInstrumentWithConfirmation(
      id,
      { confirmForce: Boolean(confirmForce) },
      adminId
    );

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Restore an instrument to Available status (reverses Not Available).
 * Does NOT restore reservations cancelled while it was Not Available.
 */
router.post('/instruments/:id/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(instruments)
      .set({ isRemoved: false })
      .where(eq(instruments.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Instrument not found.' });
      return;
    }

    res.json({
      success: true,
      instrument: updated,
      message: `"${updated.name}" is now Available and visible to members again.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
/**
 * Permanently delete an instrument row from the database
 * (For correcting mistaken entries only; separate from Decommission)
 */
router.delete('/instruments/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if instrument exists
    const [existing] = await db
      .select()
      .from(instruments)
      .where(eq(instruments.id, id));

    if (!existing) {
      res.status(404).json({ success: false, error: 'Instrument not found in database.' });
      return;
    }

    // Clean up any associated reservations / messages / notifications / series to prevent FK violations
    const tiedReservations = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(eq(reservations.instrumentId, id));

    if (tiedReservations.length > 0) {
      const resIds = tiedReservations.map((r) => r.id);
      await db.delete(notifications).where(inArray(notifications.reservationId, resIds));
      await db.delete(messages).where(inArray(messages.reservationId, resIds));
      await db.delete(reservations).where(eq(reservations.instrumentId, id));
    }

    await db.delete(reservationSeries).where(eq(reservationSeries.instrumentId, id));

    // Permanently remove the row from instruments table
    const [deleted] = await db
      .delete(instruments)
      .where(eq(instruments.id, id))
      .returning();

    res.json({
      success: true,
      instrument: deleted,
      message: `Instrument "${existing.name}" was permanently removed from the database.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   4. USER MANAGEMENT (Shared: Admin & Super Admin)
   ========================================================================= */

/**
 * Get all registered church users
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;

    let querySql = sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.is_trusted,
        u.is_active,
        u.approval_status,
        u.created_at,
        COUNT(r.id)::int as total_reservations,
        COUNT(CASE WHEN r.status = 'approved' THEN 1 END)::int as approved_reservations,
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END)::int as pending_reservations
      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id
      WHERE 1=1
    `;

    if (status === 'active') {
      querySql = sql`${querySql} AND u.is_active = true AND u.approval_status = 'approved'`;
    } else if (status === 'deactivated') {
      querySql = sql`${querySql} AND u.is_active = false AND u.approval_status = 'approved'`;
    } else if (status === 'trusted') {
      querySql = sql`${querySql} AND u.is_trusted = true`;
    } else if (status === 'pending') {
      querySql = sql`${querySql} AND u.approval_status = 'pending'`;
    } else if (status === 'rejected') {
      querySql = sql`${querySql} AND u.approval_status = 'rejected'`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      querySql = sql`${querySql} AND (u.name ILIKE ${term} OR u.email ILIKE ${term} OR u.phone_number ILIKE ${term})`;
    }

    querySql = sql`${querySql} GROUP BY u.id ORDER BY u.created_at DESC`;

    const result = await db.execute(querySql);
    const transformedUsers = ((result as any).rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      phoneNumber: row.phone_number,
      isTrusted: row.is_trusted,
      isActive: row.is_active,
      approvalStatus: row.approval_status,
      createdAt: row.created_at,
      totalReservations: row.total_reservations,
      approvedReservations: row.approved_reservations,
      pendingReservations: row.pending_reservations,
    }));
    res.json({ success: true, users: transformedUsers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Deactivate / Reactivate User Account
 */
router.post('/users/:id/toggle-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const [updated] = await db
      .update(users)
      .set({ isActive: Boolean(isActive) })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      user: updated,
      message: `User account has been ${updated.isActive ? 'reactivated' : 'deactivated'}.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Account Approvals List
 * Filter by status ('pending', 'approved', 'rejected', 'all')
 */
router.get('/approvals', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status = 'pending', search } = req.query;

    let querySql = sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.is_trusted,
        u.is_active,
        u.approval_status,
        u.created_at,
        COUNT(r.id)::int as total_reservations
      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id
      WHERE 1=1
    `;

    if (status === 'pending') {
      querySql = sql`${querySql} AND u.approval_status = 'pending'`;
    } else if (status === 'rejected') {
      querySql = sql`${querySql} AND u.approval_status = 'rejected'`;
    } else if (status === 'approved') {
      querySql = sql`${querySql} AND u.approval_status = 'approved'`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      querySql = sql`${querySql} AND (u.name ILIKE ${term} OR u.email ILIKE ${term} OR u.phone_number ILIKE ${term})`;
    }

    querySql = sql`${querySql} GROUP BY u.id ORDER BY u.created_at DESC`;

    const result = await db.execute(querySql);
    const transformedUsers = ((result as any).rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      phoneNumber: row.phone_number,
      isTrusted: row.is_trusted,
      isActive: row.is_active,
      approvalStatus: row.approval_status,
      createdAt: row.created_at,
      totalReservations: row.total_reservations,
    }));

    // Get breakdown counts
    const countsRes = await db.execute(sql`
      SELECT 
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END)::int as pending,
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END)::int as approved,
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END)::int as rejected,
        COUNT(*)::int as total
      FROM users
    `);
    const counts = (countsRes as any).rows?.[0] || { pending: 0, approved: 0, rejected: 0, total: 0 };

    res.json({
      success: true,
      users: transformedUsers,
      counts: {
        pending: Number(counts.pending || 0),
        approved: Number(counts.approved || 0),
        rejected: Number(counts.rejected || 0),
        total: Number(counts.total || 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Approve a pending user account
 */
router.post('/approvals/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(users)
      .set({
        approvalStatus: 'approved',
        isActive: true,
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      user: updated,
      message: `Account for ${updated.name} has been approved. They can now log in normally.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Alias: /users/:id/approve
router.post('/users/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(users)
      .set({
        approvalStatus: 'approved',
        isActive: true,
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      user: updated,
      message: `Account for ${updated.name} has been approved. They can now log in normally.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Reject a user account registration
 * Preserves account with approvalStatus = 'rejected' (Option B)
 */
router.post('/approvals/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(users)
      .set({
        approvalStatus: 'rejected',
        isActive: false,
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    // Terminate any active sessions for this user
    await db.delete(sessions).where(eq(sessions.userId, id));

    res.json({
      success: true,
      user: updated,
      message: `Registration for ${updated.name} has been rejected. Record preserved in audit log.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Alias: /users/:id/reject
router.post('/users/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(users)
      .set({
        approvalStatus: 'rejected',
        isActive: false,
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    await db.delete(sessions).where(eq(sessions.userId, id));

    res.json({
      success: true,
      user: updated,
      message: `Registration for ${updated.name} has been rejected. Record preserved in audit log.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Delete a user account (Cascades or cancels reservations)
 */
router.delete('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.json({ success: true, message: `Account for ${deleted.name} deleted successfully.` });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Make a reservation ON BEHALF of a user (Always Auto-Approved via Admin Privilege)
 */
router.post('/users/:userId/book-on-behalf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { instrumentId, serviceName, date, startTime, duration, reservationType } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';

    if (!serviceName || !serviceName.trim()) {
      res.status(400).json({ success: false, error: 'Service/Event name is required.' });
      return;
    }

    const result = await createReservation({
      userId,
      adminId,
      instrumentId,
      serviceName: `[Admin Booked] ${serviceName.trim()}`,
      date,
      startTime,
      duration: Number(duration) || 1,
      reservationType: reservationType === 'outside_church' ? 'outside_church' : 'in_church',
      feeAcknowledged: true,
    });

    // Notify user of administrative reservation
    try {
      await db.insert(notifications).values({
        userId,
        reservationId: result.reservation.id,
        type: 'reservation_approved',
        message: `Church Administration created and approved an instrument reservation for you: "${serviceName}" on ${date} at ${startTime}.`,
      });
    } catch {
      // non-fatal
    }

    res.status(201).json({
      success: true,
      reservation: result.reservation,
      message: 'Reservation created and auto-approved on behalf of user.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   5. MESSAGING (Shared: Admin & Super Admin)
   ========================================================================= */

/**
 * Send one-way message scoped to a specific reservation
 */
router.post('/reservations/:id/message', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';

    if (!content || !content.trim()) {
      res.status(400).json({ success: false, error: 'Message content cannot be empty.' });
      return;
    }

    const inserted = await db.execute(sql`
      INSERT INTO messages (reservation_id, admin_id, content, is_read, created_at)
      VALUES (${id}, ${adminId}, ${content.trim()}, false, NOW())
      RETURNING *
    `);

    // Fetch reservation details to notify member
    const resInfo = await db.execute(sql`SELECT user_id, service_name FROM reservations WHERE id = ${id}`);
    const userRows = (resInfo as any).rows || [];
    if (userRows.length > 0 && userRows[0].user_id) {
      await db.execute(sql`
        INSERT INTO notifications (user_id, type, message, is_read, reservation_id, created_at)
        VALUES (
          ${userRows[0].user_id}, 
          'admin_message', 
          ${`New message from administration regarding "${userRows[0].service_name || 'Reservation'}": "${content.trim()}"`}, 
          false, 
          ${id}, 
          NOW()
        )
      `);
    }

    res.json({
      success: true,
      message: (inserted as any).rows[0],
      notice: 'Message sent to member.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   6. SUPER ADMIN ONLY SECTIONS
   ========================================================================= */

/**
 * 6.0 Role Migration: Promote a member to admin without losing reservation history
 */
router.post('/users/:userId/promote', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    const [existingAdmin] = await db.select({ id: admins.id }).from(admins).where(eq(admins.phoneNumber, user.phoneNumber)).limit(1);
    if (existingAdmin) {
      res.status(409).json({ success: false, error: 'An administrator account already exists for this member.' });
      return;
    }

    const [newAdmin] = await db
      .insert(admins)
      .values({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        passwordHash: user.passwordHash,
        isSuperAdmin: false,
        role: 'admin',
        approvalStatus: 'approved',
      })
      .returning();

    await db.update(reservations).set({ adminId: newAdmin.id, userId: null }).where(eq(reservations.userId, user.id));
    await db.update(reservationSeries).set({ adminId: newAdmin.id, userId: null }).where(eq(reservationSeries.userId, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(notifications).where(eq(notifications.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));

    res.json({
      success: true,
      admin: newAdmin,
      message: `${user.name} was promoted to administrator and reservation ownership was reassigned successfully.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 6.0 Role Migration: Demote an admin back to a regular church member
 */
router.post('/admins/:adminId/demote', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { adminId } = req.params;
    const [admin] = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);

    if (!admin) {
      res.status(404).json({ success: false, error: 'Administrator not found.' });
      return;
    }

    if (admin.isSuperAdmin) {
      res.status(403).json({ success: false, error: 'Super administrators cannot be demoted using the regular admin flow.' });
      return;
    }

    const [existingUser] = await db.select().from(users).where(eq(users.phoneNumber, admin.phoneNumber)).limit(1);

    const targetUser = existingUser || (
      await db
        .insert(users)
        .values({
          name: admin.name,
          email: admin.email,
          phoneNumber: admin.phoneNumber,
          passwordHash: admin.passwordHash,
          isTrusted: false,
          isActive: true,
          approvalStatus: 'approved',
        })
        .returning()
    )[0];

    await db.update(reservations).set({ userId: targetUser.id, adminId: null }).where(eq(reservations.adminId, admin.id));
    await db.update(reservationSeries).set({ userId: targetUser.id, adminId: null }).where(eq(reservationSeries.adminId, admin.id));
    await db.delete(sessions).where(eq(sessions.adminId, admin.id));
    await db.delete(messages).where(eq(messages.adminId, admin.id));
    await db.delete(admins).where(eq(admins.id, admin.id));

    res.json({
      success: true,
      user: targetUser,
      message: `${admin.name} was demoted to a regular member and reservation ownership was reassigned successfully.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 6.1 Admin Account Management: List All Admin Accounts
 */
router.get('/admins', requireSuperAdminAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT id, name, email, phone_number, is_super_admin, role, approval_status, created_at 
      FROM admins 
      ORDER BY is_super_admin DESC, created_at ASC
    `);

    res.json({ success: true, admins: (result as any).rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6.2 Admin Account Management: Create Admin Account
 */
router.post('/admins', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phoneNumber, password, isSuperAdmin } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Administrator name is required.' });
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      res.status(400).json({ success: false, error: 'Valid administrator email address is required.' });
      return;
    }
    if (!phoneNumber) {
      res.status(400).json({ success: false, error: 'Phone number is required.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      return;
    }

    const normalized = normalizePhoneNumber(phoneNumber);

    // Check duplicate by email
    const [existing] = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, normalizedEmail)).limit(1);
    if (existing) {
      res.status(409).json({ success: false, error: 'An admin account with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newAdmin] = await db
      .insert(admins)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        phoneNumber: normalized,
        passwordHash,
        isSuperAdmin: Boolean(isSuperAdmin),
        role: isSuperAdmin ? 'super_admin' : 'admin',
        approvalStatus: 'approved',
      })
      .returning();

    res.status(201).json({
      success: true,
      admin: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email,
        phoneNumber: newAdmin.phoneNumber,
        isSuperAdmin: newAdmin.isSuperAdmin,
        role: newAdmin.role,
        approvalStatus: newAdmin.approvalStatus,
        createdAt: newAdmin.createdAt,
      },
      message: 'Administrator account created successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6.3 Admin Account Management: Remove Admin Account
 */
router.delete('/admins/:id', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentAdminId = (req as any).adminSession?.adminId;

    if (id === currentAdminId) {
      res.status(400).json({ success: false, error: 'You cannot delete your own Super Admin account.' });
      return;
    }

    const [deleted] = await db
      .delete(admins)
      .where(eq(admins.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Admin account not found.' });
      return;
    }

    res.json({ success: true, message: `Admin ${deleted.name} removed.` });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 6.4 Trusted Status Management & Audit Logs (Super Admin Only)
 */
router.post('/users/:userId/trusted-status', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isTrusted } = req.body;
    const adminId = (req as any).adminSession?.adminId || (req as any).adminUser?.id || '';

    const action = isTrusted ? 'granted' : 'revoked';

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({ isTrusted: Boolean(isTrusted) })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    // Insert Audit Log entry
    await db.insert(trustedStatusAuditLog).values({
      targetUserId: userId,
      grantedByAdminId: adminId,
      action: action as any,
    });

    // Notify user
    try {
      await db.insert(notifications).values({
        userId,
        type: isTrusted ? 'trusted_status_granted' : 'trusted_status_revoked',
        message: isTrusted
          ? 'Congratulations! You have been granted "Trusted Member" status by church administration. Your reservations are now automatically approved.'
          : 'Notice: Your "Trusted Member" status has been adjusted by church administration.',
      });
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      user: updatedUser,
      message: `Trusted status ${action} for ${updatedUser.name}.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 6.5 Get Trusted Status Audit Logs (Super Admin Only)
 */
router.get('/trusted-audit-logs', requireSuperAdminAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT 
        l.id,
        l.action,
        l.created_at,
        u.name as user_name,
        u.phone_number as user_phone,
        a.name as admin_name
      FROM trusted_status_audit_log l
      JOIN users u ON l.target_user_id = u.id
      JOIN admins a ON l.granted_by_admin_id = a.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);

    res.json({ success: true, auditLogs: (result as any).rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6.6 Hard Limits Editing (Super Admin Only)
 */
router.get('/hard-limits', requireSuperAdminAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const limits = await getHardLimits();
    res.json({ success: true, limits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/hard-limits', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const rawActive = body.maxActiveReservations ?? body.max_active_reservations;
    const rawPerDay = body.maxReservationsPerDay ?? body.max_reservations_per_day;
    const rawDuration = body.maxDurationHours ?? body.max_duration_hours;
    const rawConcurrent = body.maxConcurrentPerType ?? body.max_concurrent_per_type;
    const rawSeries = body.maxSeriesOccurrences ?? body.max_series_occurrences;
    const rawSubmissions = body.maxSubmissionsPerHour ?? body.max_submissions_per_hour;
    const rawBypass = body.bypassHardLimits ?? body.bypass_hard_limits;

    const existingRows = await db.select().from(hardLimits).orderBy(desc(hardLimits.updatedAt));
    const existing = existingRows[0];

    const parseNum = (val: any, fallback: number) => {
      if (val === undefined || val === null || val === '') return fallback;
      const num = parseInt(val, 10);
      return isNaN(num) ? fallback : num;
    };

    const newActive = parseNum(rawActive, existing?.maxActiveReservations ?? 5);
    const newPerDay = parseNum(rawPerDay, existing?.maxReservationsPerDay ?? 5);
    const newDuration = parseNum(rawDuration, existing?.maxDurationHours ?? 5);
    const newConcurrent = parseNum(rawConcurrent, existing?.maxConcurrentPerType ?? 2);
    const newSeries = parseNum(rawSeries, existing?.maxSeriesOccurrences ?? 8);
    const newSubmissions = parseNum(rawSubmissions, existing?.maxSubmissionsPerHour ?? 10);
    const newBypass = rawBypass !== undefined ? Boolean(rawBypass) : (existing?.bypassHardLimits ?? false);

    let updatedLimits;
    if (existing) {
      [updatedLimits] = await db
        .update(hardLimits)
        .set({
          maxActiveReservations: newActive,
          maxReservationsPerDay: newPerDay,
          maxDurationHours: newDuration,
          maxConcurrentPerType: newConcurrent,
          maxSeriesOccurrences: newSeries,
          maxSubmissionsPerHour: newSubmissions,
          bypassHardLimits: newBypass,
          updatedAt: new Date(),
        })
        .where(eq(hardLimits.id, existing.id))
        .returning();

      // Ensure table remains a singleton: remove any duplicate rows if they exist
      if (existingRows.length > 1) {
        await db.delete(hardLimits).where(sql`id != ${existing.id}`);
      }
    } else {
      [updatedLimits] = await db
        .insert(hardLimits)
        .values({
          maxActiveReservations: newActive,
          maxReservationsPerDay: newPerDay,
          maxDurationHours: newDuration,
          maxConcurrentPerType: newConcurrent,
          maxSeriesOccurrences: newSeries,
          maxSubmissionsPerHour: newSubmissions,
          bypassHardLimits: newBypass,
          updatedAt: new Date(),
        })
        .returning();
    }

    const formatted = {
      ...updatedLimits,
      maxActiveReservations: updatedLimits.maxActiveReservations,
      maxReservationsPerDay: updatedLimits.maxReservationsPerDay,
      maxDurationHours: updatedLimits.maxDurationHours,
      maxConcurrentPerType: updatedLimits.maxConcurrentPerType,
      maxSeriesOccurrences: updatedLimits.maxSeriesOccurrences,
      maxSubmissionsPerHour: updatedLimits.maxSubmissionsPerHour,
      bypassHardLimits: updatedLimits.bypassHardLimits,
      max_active_reservations: updatedLimits.maxActiveReservations,
      max_reservations_per_day: updatedLimits.maxReservationsPerDay,
      max_duration_hours: updatedLimits.maxDurationHours,
      max_concurrent_per_type: updatedLimits.maxConcurrentPerType,
      max_series_occurrences: updatedLimits.maxSeriesOccurrences,
      max_submissions_per_hour: updatedLimits.maxSubmissionsPerHour,
      bypass_hard_limits: updatedLimits.bypassHardLimits,
    };

    res.json({
      success: true,
      limits: formatted,
      message: 'System reservation hard limits updated successfully.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 6.7 Payment Settings (Instapay number / link) (Super Admin Only)
 */
router.get('/payment-settings', requireSuperAdminAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`SELECT * FROM payment_settings LIMIT 1`);
    let rows = (result as any).rows || [];
    if (rows.length === 0) {
      const inserted = await db.execute(sql`
        INSERT INTO payment_settings (instapay_number, instapay_link, updated_at)
        VALUES ('0100 123 4567', 'https://ipn.eg/coptic-church-instruments', NOW())
        RETURNING *
      `);
      rows = (inserted as any).rows || [];
    }
    res.json({ success: true, settings: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/payment-settings', requireSuperAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instapayNumber, instapayLink } = req.body;

    const result = await db.execute(sql`SELECT id FROM payment_settings LIMIT 1`);
    const rows = (result as any).rows || [];

    let updated;
    if (rows.length > 0) {
      const resUpdate = await db.execute(sql`
        UPDATE payment_settings 
        SET instapay_number = ${instapayNumber || null}, 
            instapay_link = ${instapayLink || null}, 
            updated_at = NOW()
        WHERE id = ${rows[0].id}
        RETURNING *
      `);
      updated = (resUpdate as any).rows?.[0];
    } else {
      const resInsert = await db.execute(sql`
        INSERT INTO payment_settings (instapay_number, instapay_link, updated_at)
        VALUES (${instapayNumber || null}, ${instapayLink || null}, NOW())
        RETURNING *
      `);
      updated = (resInsert as any).rows?.[0];
    }

    res.json({
      success: true,
      settings: updated,
      message: 'Instapay payment settings updated successfully.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
