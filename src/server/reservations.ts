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
 * 12. Query reservations (with bounds extracted)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, instrumentId, status } = req.query;

    const result = await db.execute(sql`
      SELECT 
        r.id,
        r.series_id,
        r.user_id,
        r.admin_id,
        r.instrument_id,
        r.reservation_type,
        r.fee_snapshot,
        r.status,
        r.rejection_reason,
        r.created_at,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        i.name as instrument_name,
        i.type as instrument_type,
        i.booking_mode,
        u.name as user_name,
        u.phone_number as user_phone,
        u.is_trusted as user_is_trusted
      FROM reservations r
      JOIN instruments i ON r.instrument_id = i.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE 1=1
      ${userId ? sql`AND r.user_id = ${userId as string}` : sql``}
      ${instrumentId ? sql`AND r.instrument_id = ${instrumentId as string}` : sql``}
      ${status ? sql`AND r.status = ${status as string}` : sql``}
      ORDER BY lower(r.time_range) ASC
    `);

    res.json({ success: true, reservations: (result as any).rows || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
