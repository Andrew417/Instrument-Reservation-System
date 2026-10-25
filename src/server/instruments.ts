import { Router, Request, Response } from "express";
import { db, withRetry } from "../db/index.js";
import { instruments, reservations } from "../db/schema.js";
import { eq, and, sql, asc } from "drizzle-orm";
import { validateSession } from "./session-manager.js";
import { ensureCurrentReservationStatuses } from "../services/reservation-logic.js";
import { getCairoDateString } from "../lib/date-utils.js";

const router = Router();

const MANUAL_TYPE_ORDER: string[] = ["Piano", "Drums", "Percussion", "Violin"];
const MANUAL_INSTRUMENT_ORDER_BY_TYPE: Record<string, string[]> = {
  Piano: [
    "Yamaha E-443",
    "Roland E-09",
    "Korg Pa-50",
    "Roland E-A7",
    "Roland GW-8",
  ],
  Drums: ["Tama Swing Star", "Tama Silver Star", "Tama Star Classic"],
  Percussion: ["Conga", "Bongos"],
  Violin: ["Violin 3/4"],
};

const getTypeOrderIndex = (type: string): number => {
  const normalizedType = type?.trim() || "";
  const index = MANUAL_TYPE_ORDER.findIndex(
    (item) => item.toLowerCase() === normalizedType.toLowerCase(),
  );
  return index >= 0 ? index : MANUAL_TYPE_ORDER.length + 1;
};

const getInstrumentOrderIndex = (
  type: string,
  instrumentName: string,
): number => {
  const normalizedType = type?.trim() || "";
  const matchingOrder =
    MANUAL_INSTRUMENT_ORDER_BY_TYPE[normalizedType] ??
    MANUAL_INSTRUMENT_ORDER_BY_TYPE[normalizedType.toLowerCase()] ??
    [];
  const nameIndex = matchingOrder.findIndex(
    (item) => item.toLowerCase() === instrumentName.trim().toLowerCase(),
  );
  return nameIndex >= 0 ? nameIndex : matchingOrder.length;
};

const sortInstrumentsByManualOrder = <T extends { type: string; name: string }>(
  items: T[],
): T[] => {
  return [...items].sort((a, b) => {
    const typeCompare = getTypeOrderIndex(a.type) - getTypeOrderIndex(b.type);
    if (typeCompare !== 0) return typeCompare;

    const instrumentCompare =
      getInstrumentOrderIndex(a.type, a.name) -
      getInstrumentOrderIndex(b.type, b.name);
    if (instrumentCompare !== 0) return instrumentCompare;

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
};

/**
 * Seed initial sample church instruments if table is empty
 */
export async function ensureSampleInstruments(): Promise<void> {
  await withRetry(
    async () => {
      const countRes = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(instruments);
      const count = countRes[0]?.count || 0;
      if (count === 0) {
        await db.insert(instruments).values([
          {
            name: "Yamaha E-443",
            type: "Piano",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS936UI_w4FsMusDoMEVRw9itHIR3q-aXHZ10Axo1XruQ&s=10",
            isRemoved: false,
          },
          {
            name: "Roland E-09",
            type: "Piano",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://galaxydigital.co.in/wp-content/uploads/2025/09/Roland-E09-galaxy-digital-1.jpg",
            isRemoved: false,
          },
          {
            name: "Korg Pa-50",
            type: "Piano",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://www.pngitem.com/pimgs/m/63-630610_korg-keyboard-pa-50-hd-png-download.png",
            isRemoved: false,
          },
          {
            name: "Roland E-A7",
            type: "Piano",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtzHC3gJvlF5zIFWZU4dV27kpDe8iwsMOMI4yHbavYJw&s=10",
            isRemoved: false,
          },
          {
            name: "Roland GW-8",
            type: "Piano",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcReQ8fb-aHXk0DvzRp--DGeZFnVde7WokSh-EV0cwu6EAk6DyV3H_pL4JA&s=10",
            isRemoved: false,
          },
          {
            name: "Tama Swing Star",
            type: "Drums",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://media.guitarcenter.com/is/image/MMGS7/L81860000004000-00-600x600.jpg",
            isRemoved: false,
          },
          {
            name: "Tama Silver Star",
            type: "Drums",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://4.imimg.com/data4/PJ/MF/MY-5779806/tama-silverstar-drum-set.jpg",
            isRemoved: false,
          },
          {
            name: "Tama Star Classic",
            type: "Drums",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRfmIzsInnH-xuH00D8nHLqIoRrmvtedrpwb_JIP-OOIA&s=10",
            isRemoved: false,
          },
          {
            name: "Conga",
            type: "Percussion",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/3677843c-af54-4b82-ac75-df4363c5c6b4/dfy55un-83443b29-77f4-4457-a7de-819562aa7311.png",
            isRemoved: false,
          },
          {
            name: "Bongos",
            type: "Percussion",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://www.pngitem.com/pimgs/m/414-4140737_transparent-bongos-png-cp221-aw-png-download.png",
            isRemoved: false,
          },
          {
            name: "Violin 3/4",
            type: "Violin",
            bookingMode: "manual",
            outsideFeePerDay: "0.00",
            description: null,
            photoUrl:
              "https://www.allmusicdirect.com.au/cdn/shop/products/VIENC44_in_case_display__92422_4edc67ac-0fe7-49bf-8d65-d0091fc78a7e_1024x1024.png?v=1587526435",
            isRemoved: false,
          },
        ]);
      }
    },
    { retries: 5, delayMs: 2500, label: "Sample Instruments Seed" },
  );
}

// Auto-seed in background on startup with retry
ensureSampleInstruments().catch((err: any) => {
  console.warn("[Instruments Seed Notice]:", err?.message || err);
});

/**
 * Helper to determine caller identity and roles for visibility rules
 */
async function resolveUserRoleFromRequest(req: Request): Promise<{
  isAdmin: boolean;
  isMusician: boolean;
  userId: string | null;
}> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : (req.headers["x-session-token"] as string);

  if (!token) {
    return { isAdmin: false, isMusician: false, userId: null };
  }

  try {
    const { valid, session } = await validateSession(token);
    if (valid && session) {
      const isAdm =
        session.role === "admin" ||
        session.role === "super_admin" ||
        Boolean(session.user?.isSuperAdmin);
      return {
        isAdmin: isAdm,
        isMusician: Boolean(session.user?.isMusician),
        userId: session.user?.id || session.userId || null,
      };
    }
  } catch {
    // Ignore and fallback to guest
  }

  return { isAdmin: false, isMusician: false, userId: null };
}

/**
 * 0. Get requestable instrument types with their outside flat fees
 */
router.get("/types", async (_req: Request, res: Response): Promise<void> => {
  try {
    const typeRows = await db.execute(sql`
      SELECT type, can_be_requested, flat_fee_outside
      FROM instrument_type_settings
      WHERE can_be_requested = true
      ORDER BY type ASC;
    `);

    res.json({
      success: true,
      types: ((typeRows as any).rows || []).map((r: any) => ({
        type: r.type,
        canBeRequested: Boolean(r.can_be_requested),
        flatFeeOutside: String(r.flat_fee_outside || "0.00"),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 1. Get all active instruments (filtered by role visibility)
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { isAdmin, isMusician } = await resolveUserRoleFromRequest(req);

    let whereClause = sql`${instruments.isRemoved} = false`;
    if (!isAdmin) {
      if (isMusician) {
        whereClause = sql`${whereClause} AND ${instruments.visibilityLevel} IN ('public', 'musician')`;
      } else {
        whereClause = sql`${whereClause} AND ${instruments.visibilityLevel} = 'public'`;
      }
    }

    const list = await db
      .select()
      .from(instruments)
      .where(whereClause)
      .orderBy(asc(instruments.type), asc(instruments.name));

    const formatted = sortInstrumentsByManualOrder(list).map((inst) => ({
      ...inst,
      booking_mode: inst.bookingMode,
      outside_fee_per_day: inst.outsideFeePerDay,
      visibility_level: inst.visibilityLevel,
      is_out_of_service: inst.isOutOfService,
      photo_url: inst.photoUrl,
      is_removed: inst.isRemoved,
      created_at: inst.createdAt,
    }));

    res.json({ success: true, instruments: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Get availability for all instruments on a given date (YYYY-MM-DD)
 * Returns instruments grouped by type, with their approved reservation time-slots for privacy
 */
router.get(
  "/availability/date",
  async (req: Request, res: Response): Promise<void> => {
    try {
      await ensureCurrentReservationStatuses().catch(() => {});
      const dateStr = (req.query.date as string) || getCairoDateString();

      const { isAdmin, isMusician, userId: currentUserId } =
        await resolveUserRoleFromRequest(req);

      // Filter visible instruments
      let whereClause = sql`${instruments.isRemoved} = false`;
      if (!isAdmin) {
        if (isMusician) {
          whereClause = sql`${whereClause} AND ${instruments.visibilityLevel} IN ('public', 'musician')`;
        } else {
          whereClause = sql`${whereClause} AND ${instruments.visibilityLevel} = 'public'`;
        }
      }

      const allInstruments = await db
        .select()
        .from(instruments)
        .where(whereClause)
        .orderBy(asc(instruments.type), asc(instruments.name));

      const formattedInstruments = sortInstrumentsByManualOrder(
        allInstruments,
      ).map((inst) => ({
        ...inst,
        booking_mode: inst.bookingMode,
        outside_fee_per_day: inst.outsideFeePerDay,
        visibility_level: inst.visibilityLevel,
        is_out_of_service: inst.isOutOfService,
        photo_url: inst.photoUrl,
        is_removed: inst.isRemoved,
        created_at: inst.createdAt,
      }));

      // Query approved / ongoing reservations on that date
      // Note: Only reservations with an assigned instrumentId are relevant for slots.
      // Pending type requests without an instrument never appear on the calendar and don't block slots.
      const reservationsOnDate = await db.execute(sql`
      SELECT 
        r.id,
        r.instrument_id,
        r.status,
        r.reservation_type,
        r.user_id,
        r.admin_id,
        r.service_name,
        COALESCE(u.name, a.name, 'Administrator') as user_name,
        lower(r.time_range) as start_time,
        upper(r.time_range) as end_time,
        to_char(lower(r.time_range) AT TIME ZONE 'Africa/Cairo', 'HH24:MI') as start_hhmm,
        to_char(upper(r.time_range) AT TIME ZONE 'Africa/Cairo', 'HH24:MI') as end_hhmm,
        ROUND(EXTRACT(EPOCH FROM (upper(r.time_range) - lower(r.time_range))) / 3600.0, 1) as duration_hours
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN admins a ON r.admin_id = a.id
      WHERE r.status IN ('approved', 'ongoing', 'completed')
        AND r.instrument_id IS NOT NULL
        AND (lower(r.time_range) AT TIME ZONE 'Africa/Cairo')::date = ${dateStr}::date
      ORDER BY lower(r.time_range) ASC
    `);

      const reservedSlots = (reservationsOnDate as any).rows || [];

      res.json({
        success: true,
        date: dateStr,
        instruments: formattedInstruments,
        reservations: reservedSlots.map((r: any) => {
          const isFullDay =
            (r.start_hhmm === "09:00" && r.end_hhmm === "22:00") ||
            Number(r.duration_hours) >= 13;
          return {
            id: r.id,
            instrumentId: r.instrument_id,
            status: r.status,
            reservationType: r.reservation_type,
            isFullDay,
            // Only reveal reservant identity, userId & service name to admins/super admins
            userId: isAdmin ? r.user_id || r.admin_id : undefined,
            userName: isAdmin ? r.user_name : undefined,
            serviceName: isAdmin ? r.service_name : undefined,
            startTime: r.start_time,
            endTime: r.end_time,
            startHhmm: r.start_hhmm,
            endHhmm: r.end_hhmm,
          };
        }),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// Alias for convenience /availability -> /availability/date
router.get("/availability", async (req: Request, res: Response): Promise<void> => {
  // Delegate directly to the availability/date handler logic
  req.url = "/availability/date" + (req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "");
  (router as any).handle(req, res, () => {});
});

/**
 * 3. Get single instrument by ID (Enforces visibility level rules)
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // UUID format check (prevent invalid syntax error)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      res
        .status(400)
        .json({ success: false, error: "Invalid instrument ID format" });
      return;
    }

    const [inst] = await db
      .select()
      .from(instruments)
      .where(and(eq(instruments.id, id), eq(instruments.isRemoved, false)))
      .limit(1);

    if (!inst) {
      res.status(404).json({ success: false, error: "Instrument not found" });
      return;
    }

    const { isAdmin, isMusician } = await resolveUserRoleFromRequest(req);
    if (!isAdmin) {
      if (inst.visibilityLevel === "room_stock") {
        res.status(404).json({ success: false, error: "Instrument not found" });
        return;
      }
      if (inst.visibilityLevel === "musician" && !isMusician) {
        res.status(404).json({ success: false, error: "Instrument not found" });
        return;
      }
    }

    res.json({
      success: true,
      instrument: {
        ...inst,
        booking_mode: inst.bookingMode,
        outside_fee_per_day: inst.outsideFeePerDay,
        visibility_level: inst.visibilityLevel,
        is_out_of_service: inst.isOutOfService,
        photo_url: inst.photoUrl,
        is_removed: inst.isRemoved,
        created_at: inst.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Update instrument booking mode (Admin / Super Admin)
 */
router.put("/:id/mode", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : (req.headers["x-session-token"] as string);

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Please sign in.",
      });
      return;
    }

    const { valid, session } = await validateSession(token);
    if (
      !valid ||
      !session ||
      (session.role !== "admin" && session.role !== "super_admin")
    ) {
      res.status(403).json({
        success: false,
        error: "Administrator privileges required to change booking mode.",
      });
      return;
    }

    const { id } = req.params;
    const { bookingMode } = req.body;
    if (bookingMode !== "instant" && bookingMode !== "manual") {
      res.status(400).json({
        success: false,
        error: "bookingMode must be either instant or manual",
      });
      return;
    }

    const updated = await db
      .update(instruments)
      .set({ bookingMode })
      .where(eq(instruments.id, id))
      .returning();

    if (!updated.length) {
      res.status(404).json({ success: false, error: "Instrument not found" });
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

    res.json({
      success: true,
      instrument: formatted,
      message: `Instrument mode updated to ${bookingMode}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
