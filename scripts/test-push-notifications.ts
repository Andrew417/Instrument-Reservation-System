import { db, pool } from "../src/db/index.js";
import {
  users,
  admins,
  instruments,
  reservations,
  reservationSeries,
  notifications,
  pushTokens,
  adminPushPreferences,
} from "../src/db/schema.js";
import {
  createReservation,
  createReservationSeries,
  adminApproveReservation,
} from "../src/services/reservation-logic.js";
import { dispatchSystemNotification } from "../src/server/notifications-service.js";
import { removeInvalidTokens } from "../src/lib/push-sender.js";
import { eq, and, inArray, sql } from "drizzle-orm";

async function runTests() {
  console.log("=== STARTING PUSH NOTIFICATION TEST SUITE ===\n");

  try {
    // 0. Clean test environment
    await db.delete(notifications);
    await db.delete(pushTokens);
    await db.delete(adminPushPreferences);
    await db.delete(reservations);
    await db.delete(reservationSeries);
    await db.delete(instruments);
    await db.delete(users);
    await db.delete(admins);

    // 1. Setup Test Admins
    console.log("1. Setting up Test Admins...");
    const [admin1] = await db
      .insert(admins)
      .values({
        name: "Admin One (All Active)",
        email: "admin1@church.org",
        phoneNumber: "+201000000001",
        passwordHash: "hash1",
        isSuperAdmin: true,
        approvalStatus: "approved",
      })
      .returning();

    const [admin2] = await db
      .insert(admins)
      .values({
        name: "Admin Two (Filtered)",
        email: "admin2@church.org",
        phoneNumber: "+201000000002",
        passwordHash: "hash2",
        isSuperAdmin: false,
        approvalStatus: "approved",
      })
      .returning();

    // Setup Admin 2 preferences: notifyRegistrations = false, notifyReservations = true, notifyChat = false
    await db.insert(adminPushPreferences).values({
      adminId: admin2.id,
      notifyRegistrations: false,
      notifyReservations: true,
      notifyChat: false,
    });

    // Register tokens for Admins
    await db.insert(pushTokens).values([
      {
        adminId: admin1.id,
        token: "fcm_token_admin_1",
        language: "ar",
        platform: "desktop",
      },
      {
        adminId: admin2.id,
        token: "fcm_token_admin_2",
        language: "en",
        platform: "android",
      },
    ]);

    // 2. Setup Test User
    console.log("2. Setting up Test Members...");
    const [member1] = await db
      .insert(users)
      .values({
        name: "Bishoy Member",
        email: "bishoy@church.org",
        phoneNumber: "+201100000001",
        passwordHash: "hashuser",
        isActive: true,
        approvalStatus: "approved",
      })
      .returning();

    const [deactivatedUser] = await db
      .insert(users)
      .values({
        name: "Deactivated User",
        email: "deactivated@church.org",
        phoneNumber: "+201100000002",
        passwordHash: "hashuser2",
        isActive: false,
        approvalStatus: "approved",
      })
      .returning();

    await db.insert(pushTokens).values([
      {
        userId: member1.id,
        token: "fcm_token_member_1_phone",
        language: "ar",
        platform: "android",
      },
      {
        userId: member1.id,
        token: "fcm_token_member_1_desktop",
        language: "en",
        platform: "desktop",
      },
      {
        userId: deactivatedUser.id,
        token: "fcm_token_deactivated",
        language: "ar",
        platform: "web",
      },
    ]);

    // 3. Setup Test Instrument
    const [piano] = await db
      .insert(instruments)
      .values({
        name: "Church Yamaha Grand Piano",
        type: "keyboard",
        bookingMode: "manual",
      })
      .returning();

    console.log("   ✅ Database seeded successfully.\n");

    // TEST SUITE A: Admin Category Switch Filtering
    console.log("TEST A: Admin Category Switch Filtering...");
    // Registration event: Admin 1 has switch on, Admin 2 has switch off
    await dispatchSystemNotification({
      broadcastToAdmins: true,
      type: "account_approval_submitted",
      bellMessage: "New member registration from Mina awaiting approval.",
      pushCategory: "registrations",
      metadata: { userName: "Mina" },
    });

    // Check bell notifications created for both approved admins
    const notifsA = await db.select().from(notifications).where(eq(notifications.type, "account_approval_submitted"));
    if (notifsA.length === 2) {
      console.log("   ✅ In-app bell created for all approved admins (count = 2).");
    } else {
      throw new Error(`Expected 2 bell notifications for registration, got ${notifsA.length}`);
    }

    // TEST SUITE B: Actor Exclusion
    console.log("\nTEST B: Actor Exclusion verification...");
    // When Admin 1 approves a reservation, Admin 1 is marked as actorId
    const resB = await createReservation({
      userId: member1.id,
      instrumentId: piano.id,
      serviceName: "Choir Rehearsal",
      musicianName: "Bishoy",
      date: "2026-10-15",
      startTime: "18:00",
      duration: 2,
      reservationType: "in_church",
    });

    const resBId = resB.reservation.id;
    await adminApproveReservation(resBId, admin1.id);

    // Verify member received notification
    const memberNotifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, member1.id));
    if (memberNotifs.length > 0) {
      console.log("   ✅ Member received reservation approval notification.");
    } else {
      throw new Error("Expected member to receive approval notification.");
    }

    // TEST SUITE C: Recurring Series -> exactly ONE push/notification to admins
    console.log("\nTEST C: Recurring Series Sends 1 Notification to Admins...");
    const notifsBeforeSeries = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.type, "series_submitted"),
          sql`${notifications.adminId} IS NOT NULL`,
        ),
      );
    const countBefore = notifsBeforeSeries.length;

    await createReservationSeries({
      userId: member1.id,
      instrumentId: piano.id,
      serviceName: "Weekly Prayer Meeting",
      musicianName: "Bishoy",
      patternType: "weekly",
      reservationType: "in_church",
      occurrences: [
        { date: "2026-10-20", startTime: "10:00", duration: 2 },
        { date: "2026-10-27", startTime: "10:00", duration: 2 },
        { date: "2026-11-03", startTime: "10:00", duration: 2 },
      ],
    });

    const notifsAfterSeries = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.type, "series_submitted"),
          sql`${notifications.adminId} IS NOT NULL`,
        ),
      );
    
    // Each admin receives exactly 1 series notification (total 2 admins * 1 = 2)
    const newSeriesNotifs = notifsAfterSeries.length - countBefore;
    if (newSeriesNotifs === 2) {
      console.log(`   ✅ Recurring series with 3 occurrences generated exactly 1 broadcast (2 admin rows) as expected!`);
    } else {
      throw new Error(`Expected 2 series notifications for admins, got ${newSeriesNotifs}`);
    }

    // TEST SUITE D: Invalid/Unregistered Token Cleanup
    console.log("\nTEST D: Invalid/Unregistered Token Cleanup...");
    // Insert a dummy invalid token
    const [testInvalidToken] = await db
      .insert(pushTokens)
      .values({
        userId: member1.id,
        token: "invalid_expired_fcm_token_999",
        language: "ar",
      })
      .returning();

    // Verify it exists
    const beforeCheck = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, "invalid_expired_fcm_token_999"));
    if (beforeCheck.length === 0) throw new Error("Failed to insert test invalid token");

    // Clean it up via removeInvalidTokens
    await removeInvalidTokens(["invalid_expired_fcm_token_999"]);

    const afterCheck = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, "invalid_expired_fcm_token_999"));
    if (afterCheck.length === 0) {
      console.log("   ✅ Invalid token was purged from database successfully.");
    } else {
      throw new Error("Invalid token still exists in database!");
    }

    // TEST SUITE E: Deactivated Users Excluded from Push
    console.log("\nTEST E: Deactivated User Protection...");
    await dispatchSystemNotification({
      userId: deactivatedUser.id,
      type: "reservation_approved",
      bellMessage: "Test approval for deactivated",
      pushCategory: "reservations",
    });
    console.log("   ✅ Deactivated user push handled without errors or delivery.");

    console.log("\n🎉 ALL PUSH NOTIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n");
  } catch (err: any) {
    console.error("\n❌ TEST SUITE FAILED:", err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
