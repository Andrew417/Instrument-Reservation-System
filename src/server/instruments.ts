import { Router, Request, Response } from 'express';
import { db } from '../db/index.ts';
import { instruments, reservations } from '../db/schema.ts';
import { eq, and, sql, asc } from 'drizzle-orm';

const router = Router();

/**
 * Seed initial sample church instruments if table is empty
 */
async function ensureSampleInstruments() {
  const countRes = await db.select({ count: sql<number>`count(*)::int` }).from(instruments);
  const count = countRes[0]?.count || 0;
  if (count === 0) {
    await db.insert(instruments).values([
      {
        name: 'Yamaha C7 Grand Piano',
        type: 'Keyboards',
        bookingMode: 'manual',
        outsideFeePerDay: '500.00',
        description: 'Main sanctuary concert grand piano. Pristine acoustic condition with weighted action.',
        isRemoved: false,
      },
      {
        name: 'Nord Stage 3 88-Key Synthesizer',
        type: 'Keyboards',
        bookingMode: 'instant',
        outsideFeePerDay: '350.00',
        description: 'Flagship stage keyboard with organ, piano, and synth engines. In choir hall.',
        isRemoved: false,
      },
      {
        name: 'Korg Kronos 73-Key Workstation',
        type: 'Keyboards',
        bookingMode: 'instant',
        outsideFeePerDay: '300.00',
        description: 'Multi-engine workstation with sound library and sequencer.',
        isRemoved: false,
      },
      {
        name: 'Fender Stratocaster Electric Guitar',
        type: 'Strings',
        bookingMode: 'instant',
        outsideFeePerDay: '150.00',
        description: 'American Performer Stratocaster in sunburst finish with dual single-coil pickups.',
        isRemoved: false,
      },
      {
        name: 'Taylor 214ce Acoustic-Electric Guitar',
        type: 'Strings',
        bookingMode: 'instant',
        outsideFeePerDay: '200.00',
        description: 'Grand Auditorium cutaway acoustic-electric with ES2 electronics.',
        isRemoved: false,
      },
      {
        name: 'Yamaha 5-String Bass Guitar',
        type: 'Strings',
        bookingMode: 'instant',
        outsideFeePerDay: '150.00',
        description: 'TRBX active 5-string bass guitar with versatile EQ.',
        isRemoved: false,
      },
      {
        name: 'Yamaha Custom Oak Drum Kit',
        type: 'Percussion',
        bookingMode: 'manual',
        outsideFeePerDay: '400.00',
        description: '5-piece acoustic drum set with Zildjian K Custom cymbals inside sound isolation booth.',
        isRemoved: false,
      },
      {
        name: 'Roland V-Drums TD-27KV2 Electronic Kit',
        type: 'Percussion',
        bookingMode: 'instant',
        outsideFeePerDay: '250.00',
        description: 'Mesh head electronic drum kit with realistic digital snare and ride cymbals.',
        isRemoved: false,
      },
      {
        name: 'Schilke Custom Trumpet (B♭)',
        type: 'Wind & Brass',
        bookingMode: 'manual',
        outsideFeePerDay: '180.00',
        description: 'Handcrafted B-flat professional orchestral trumpet.',
        isRemoved: false,
      },
      {
        name: 'Yamaha YAS-62 Professional Alto Saxophone',
        type: 'Wind & Brass',
        bookingMode: 'manual',
        outsideFeePerDay: '220.00',
        description: 'Gold-lacquered professional E-flat alto saxophone with custom 62 neck.',
        isRemoved: false,
      },
    ]);
  }
}

// Auto-seed in background on startup
ensureSampleInstruments().catch(console.error);

/**
 * 1. Get all active instruments
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(instruments)
      .where(eq(instruments.isRemoved, false))
      .orderBy(asc(instruments.type), asc(instruments.name));

    res.json({ success: true, instruments: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Get availability for all instruments on a given date (YYYY-MM-DD)
 * Returns instruments grouped by type, with their approved reservation time-slots for privacy
 */
router.get('/availability/date', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    // 1. Get all active instruments
    const allInstruments = await db
      .select()
      .from(instruments)
      .where(eq(instruments.isRemoved, false))
      .orderBy(asc(instruments.type), asc(instruments.name));

    // 2. Query approved / ongoing reservations on that date
    // Note: To preserve user privacy as required, other users see only the time slot block (no personal info)
    const reservationsOnDate = await db.execute(sql`
      SELECT 
        r.id,
        r.instrument_id,
        r.status,
        r.reservation_type,
        r.user_id,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        to_char(lower(r.time_range), 'HH24:MI') as start_hhmm,
        to_char(upper(r.time_range), 'HH24:MI') as end_hhmm
      FROM reservations r
      WHERE r.status IN ('approved', 'ongoing')
        AND lower(r.time_range)::date = ${dateStr}::date
      ORDER BY lower(r.time_range) ASC
    `);

    const reservedSlots = (reservationsOnDate as any).rows || [];

    res.json({
      success: true,
      date: dateStr,
      instruments: allInstruments,
      reservations: reservedSlots.map((r: any) => ({
        id: r.id,
        instrumentId: r.instrument_id,
        status: r.status,
        reservationType: r.reservation_type,
        userId: r.user_id,
        startTime: r.start_time,
        endTime: r.end_time,
        startHhmm: r.start_hhmm,
        endHhmm: r.end_hhmm,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias for convenience /availability -> /availability/date
router.get('/availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const allInstruments = await db
      .select()
      .from(instruments)
      .where(eq(instruments.isRemoved, false))
      .orderBy(asc(instruments.type), asc(instruments.name));

    const reservationsOnDate = await db.execute(sql`
      SELECT 
        r.id,
        r.instrument_id,
        r.status,
        r.reservation_type,
        r.user_id,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        to_char(lower(r.time_range), 'HH24:MI') as start_hhmm,
        to_char(upper(r.time_range), 'HH24:MI') as end_hhmm
      FROM reservations r
      WHERE r.status IN ('approved', 'ongoing')
        AND lower(r.time_range)::date = ${dateStr}::date
      ORDER BY lower(r.time_range) ASC
    `);

    const reservedSlots = (reservationsOnDate as any).rows || [];

    res.json({
      success: true,
      date: dateStr,
      instruments: allInstruments,
      reservations: reservedSlots.map((r: any) => ({
        id: r.id,
        instrumentId: r.instrument_id,
        status: r.status,
        reservationType: r.reservation_type,
        userId: r.user_id,
        startTime: r.start_time,
        endTime: r.end_time,
        startHhmm: r.start_hhmm,
        endHhmm: r.end_hhmm,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Get single instrument by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // UUID format check (prevent invalid syntax error)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      res.status(400).json({ success: false, error: 'Invalid instrument ID format' });
      return;
    }

    const [inst] = await db
      .select()
      .from(instruments)
      .where(eq(instruments.id, id))
      .limit(1);

    if (!inst) {
      res.status(404).json({ success: false, error: 'Instrument not found' });
      return;
    }

    res.json({ success: true, instrument: inst });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
