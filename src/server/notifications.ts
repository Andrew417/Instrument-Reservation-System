import { Router, Request, Response } from 'express';
import { db } from '../db/index.ts';
import { sql } from 'drizzle-orm';
import { validateSession } from './session-manager.ts';

const router = Router();

/**
 * Helper to resolve authenticated user ID from Authorization header or query param
 */
async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.headers['x-session-token'] as string);

  if (token) {
    const { valid, session } = await validateSession(token);
    if (valid && session && session.userId) {
      return session.userId;
    }
  }

  if (req.query.userId && typeof req.query.userId === 'string') {
    return req.query.userId;
  }
  if (req.body?.userId && typeof req.body.userId === 'string') {
    return req.body.userId;
  }

  // Fallback to first user in system for demo/development if not logged in
  const fallbackUserRes = await db.execute(sql`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
  const userRows = (fallbackUserRes as any).rows || [];
  return userRows.length > 0 ? userRows[0].id : null;
}

/**
 * 1. GET /api/notifications
 * Fetch user notifications with unread badge count
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);

    if (!userId) {
      res.json({ success: true, notifications: [], unreadCount: 0 });
      return;
    }

    const result = await db.execute(sql`
      SELECT 
        n.id,
        n.user_id,
        n.type,
        n.message,
        n.is_read,
        n.reservation_id,
        n.created_at,
        r.status as reservation_status,
        r.service_name,
        r.rejection_reason,
        i.name as instrument_name
      FROM notifications n
      LEFT JOIN reservations r ON n.reservation_id = r.id
      LEFT JOIN instruments i ON r.instrument_id = i.id
      WHERE n.user_id = ${userId}
      ORDER BY n.created_at DESC
      LIMIT 100
    `);

    const countRes = await db.execute(sql`
      SELECT COUNT(*)::int as unread_count 
      FROM notifications 
      WHERE user_id = ${userId} AND is_read = false
    `);

    const notifications = (result as any).rows || [];
    const unreadCount = Number((countRes as any).rows?.[0]?.unread_count || 0);

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. POST /api/notifications/:id/read
 * Mark a single notification as read
 */
router.post('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.execute(sql`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = ${id}
      RETURNING *
    `);

    res.json({ success: true, notification: (result as any).rows?.[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. POST /api/notifications/mark-all-read
 * Mark all notifications for user as read
 */
router.post('/mark-all-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);

    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }

    await db.execute(sql`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = ${userId} AND is_read = false
    `);

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. POST /api/notifications/seed-samples
 * Seeds standard sample notifications for testing the 5 required types
 */
router.post('/seed-samples', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);

    if (!userId) {
      res.status(400).json({ success: false, error: 'User not found' });
      return;
    }

    // Lookup user's latest reservations to attach real reservation IDs
    const resResult = await db.execute(sql`
      SELECT id, service_name, status, rejection_reason 
      FROM reservations 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    const userReservations = (resResult as any).rows || [];
    const sampleResId = userReservations[0]?.id || null;

    const samples = [
      {
        type: 'reservation_approved',
        message: 'Your reservation for "Sunday Holy Liturgy" was approved (Instant Auto-Approval).',
        resId: sampleResId,
      },
      {
        type: 'reservation_rejected',
        message: 'Your reservation request was rejected by an administrator. Reason: Priority rehearsal assigned for Senior Deacon Choir.',
        resId: sampleResId,
      },
      {
        type: 'reservation_auto_rejected',
        message: 'Your pending reservation was auto-rejected due to a schedule conflict: Another priority reservation was approved for this time slot.',
        resId: sampleResId,
      },
      {
        type: 'instrument_removed_cancellation',
        message: 'Your upcoming reservation was cancelled because the instrument was removed from active inventory for scheduled maintenance.',
        resId: sampleResId,
      },
      {
        type: 'admin_message',
        message: 'New message from Father Youhanna (Admin): "Please make sure to return the microphone cables to the audio room after service."',
        resId: sampleResId,
      },
    ];

    for (const sample of samples) {
      if (sample.resId) {
        await db.execute(sql`
          INSERT INTO notifications (user_id, type, message, is_read, reservation_id, created_at)
          VALUES (${userId}, ${sample.type}, ${sample.message}, false, ${sample.resId}, NOW())
        `);
      } else {
        await db.execute(sql`
          INSERT INTO notifications (user_id, type, message, is_read, created_at)
          VALUES (${userId}, ${sample.type}, ${sample.message}, false, NOW())
        `);
      }
    }

    res.json({ success: true, message: 'Sample notifications seeded successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
