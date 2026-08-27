import { Router, Request, Response } from 'express';
import {
  createReservation,
  createReservationSeries,
  editReservation,
  cancelReservation,
  adminApproveReservation,
  adminRejectReservation,
  adminApproveSeries,
  adminRejectSeries,
  runStatusTransitions,
  removeInstrumentWithConfirmation,
  evaluateReservationSubmission,
  getHardLimits,
} from '../services/reservation-logic.ts';
import { db } from '../db/index.ts';
import { instruments, reservations, reservationSeries, notifications, users, admins } from '../db/schema.ts';
import { eq, and, sql, desc } from 'drizzle-orm';

const router = Router();

/**
 * 0. Get current hard limits
 */
router.get('/limits', async (_req: Request, res: Response): Promise<void> => {
  try {
    const limits = await getHardLimits();
    res.json({ success: true, limits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 1. Evaluate/Dry-run submission without creating a row
 */
router.post('/evaluate', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await evaluateReservationSubmission(req.body);
    res.json({ success: true, evaluation: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, conflicts: err.conflicts });
  }
});

/**
 * 2. Create single reservation
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.serviceName || !req.body.serviceName.trim()) {
      res.status(400).json({ success: false, error: 'What this reservation is for (service_name) is required.' });
      return;
    }
    const result = await createReservation(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, conflicts: err.conflicts });
  }
});

/**
 * 3. Create recurring reservation series
 */
router.post('/series', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body.serviceName || !req.body.serviceName.trim()) {
      res.status(400).json({ success: false, error: 'What this reservation is for (service_name) is required for the series.' });
      return;
    }
    const result = await createReservationSeries(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message, conflicts: err.conflicts });
  }
});

/**
 * 4. Edit a reservation
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId, adminId, isSuperAdmin, ...updates } = req.body;
    const updated = await editReservation(id, updates, { userId, adminId, isSuperAdmin });
    res.json({ success: true, reservation: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 5. Cancel a reservation (single or series)
 */
router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId, adminId, cancelMode } = req.body;
    const result = await cancelReservation(id, { cancelMode }, { userId, adminId });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 6. Admin: Approve single reservation
 */
router.post('/admin/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    const result = await adminApproveReservation(id, adminId || '');
    res.json({ success: true, reservation: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 7. Admin: Reject single reservation
 */
router.post('/admin/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, adminId } = req.body;
    const result = await adminRejectReservation(id, reason, adminId || '');
    res.json({ success: true, reservation: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 8. Admin: Approve all future occurrences in a series
 */
router.post('/admin/series/:seriesId/approve-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { seriesId } = req.params;
    const { adminId } = req.body;
    const result = await adminApproveSeries(seriesId, adminId || '');
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 9. Admin: Reject all future occurrences in a series
 */
router.post('/admin/series/:seriesId/reject-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { seriesId } = req.params;
    const { reason, adminId } = req.body;
    const result = await adminRejectSeries(seriesId, reason, adminId || '');
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 10. Admin: Force remove instrument with confirmation
 */
router.post('/admin/instruments/:id/remove', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { confirmForce, adminId } = req.body;
    const result = await removeInstrumentWithConfirmation(id, { confirmForce: Boolean(confirmForce) }, adminId || '');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * 11. Run scheduled status transitions
 */
router.post('/transitions/run', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await runStatusTransitions();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 12. Get payment settings (Instapay details)
 */
router.get('/payment-settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`SELECT * FROM payment_settings LIMIT 1`);
    let rows = (result as any).rows || [];
    if (rows.length === 0) {
      // Initialize default payment settings
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

/**
 * 13. Get single reservation messages (scoped to this reservation)
 */
router.get('/:id/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT 
        m.id,
        m.reservation_id,
        m.admin_id,
        m.content,
        m.is_read,
        m.created_at,
        a.name as admin_name
      FROM messages m
      LEFT JOIN admins a ON m.admin_id = a.id
      WHERE m.reservation_id = ${id}
      ORDER BY m.created_at ASC
    `);

    res.json({ success: true, messages: (result as any).rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 14. Upload / update payment screenshot for reservation
 */
router.post('/:id/payment-screenshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { screenshotUrl } = req.body;

    if (!screenshotUrl) {
      res.status(400).json({ success: false, error: 'screenshotUrl is required' });
      return;
    }

    const result = await db.execute(sql`
      UPDATE reservations
      SET payment_screenshot_url = ${screenshotUrl}
      WHERE id = ${id}
      RETURNING *
    `);

    const rows = (result as any).rows || [];
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Reservation not found' });
      return;
    }

    res.json({ success: true, reservation: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 15. Post message to reservation (by admin or test)
 */
router.post('/:id/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminId, content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ success: false, error: 'Message content is required' });
      return;
    }

    // Lookup first admin if adminId not provided
    let effectiveAdminId = adminId;
    if (!effectiveAdminId) {
      const adminRes = await db.execute(sql`SELECT id FROM admins LIMIT 1`);
      const adminsList = (adminRes as any).rows || [];
      if (adminsList.length > 0) {
        effectiveAdminId = adminsList[0].id;
      }
    }

    if (!effectiveAdminId) {
      res.status(400).json({ success: false, error: 'No admin found to author message' });
      return;
    }

    const inserted = await db.execute(sql`
      INSERT INTO messages (reservation_id, admin_id, content, is_read, created_at)
      VALUES (${id}, ${effectiveAdminId}, ${content.trim()}, false, NOW())
      RETURNING *
    `);

    // Create notification for user
    try {
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
    } catch (notifErr: any) {
      console.warn('Could not insert admin message notification:', notifErr.message);
    }

    res.json({ success: true, message: (inserted as any).rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 16. Get single reservation detail
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.execute(sql`
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
        i.name as instrument_name,
        i.type as instrument_type,
        i.booking_mode,
        i.outside_fee_per_day,
        i.photo_url as instrument_photo_url,
        i.description as instrument_description,
        s.pattern_type as series_pattern_type,
        u.name as user_name,
        u.phone_number as user_phone,
        u.is_trusted as user_is_trusted
      FROM reservations r
      JOIN instruments i ON r.instrument_id = i.id
      LEFT JOIN reservation_series s ON r.series_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ${id}
      LIMIT 1
    `);

    const rows = (result as any).rows || [];
    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Reservation not found' });
      return;
    }

    res.json({ success: true, reservation: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 17. Query reservations (with bounds extracted)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, instrumentId, status, seriesId } = req.query;

    const result = await db.execute(sql`
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
        i.name as instrument_name,
        i.type as instrument_type,
        i.booking_mode,
        i.outside_fee_per_day,
        i.photo_url as instrument_photo_url,
        i.description as instrument_description,
        s.pattern_type as series_pattern_type,
        u.name as user_name,
        u.phone_number as user_phone,
        u.is_trusted as user_is_trusted
      FROM reservations r
      JOIN instruments i ON r.instrument_id = i.id
      LEFT JOIN reservation_series s ON r.series_id = s.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE 1=1
      ${userId ? sql`AND r.user_id = ${userId as string}` : sql``}
      ${instrumentId ? sql`AND r.instrument_id = ${instrumentId as string}` : sql``}
      ${status ? sql`AND r.status = ${status as string}` : sql``}
      ${seriesId ? sql`AND r.series_id = ${seriesId as string}` : sql``}
      ORDER BY lower(r.time_range) ASC
    `);

    res.json({ success: true, reservations: (result as any).rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
