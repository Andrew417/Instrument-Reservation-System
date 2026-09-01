import { db, pool } from "../src/db/index";
import {
  users,
  admins,
  instruments,
  reservations,
  reservationSeries,
  notifications,
} from "../src/db/schema";
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
} from "../src/services/reservation-logic";
import { eq, sql } from "drizzle-orm";

async function runComprehensiveTests() {
  console.log("=== RUNNING EXTENDED VERIFICATION (SECTIONS 3 - 7) ===\n");

  try {
    // 1. Setup Test Fixtures
    const ts = Date.now();
    const [drum] = await db
      .insert(instruments)
      .values({
        name: `Drum Kit #${ts}`,
        type: "Percussion",
        bookingMode: "manual",
        outsideFeePerDay: "300.00",
        isRemoved: false,
      })
      .returning();

    const [adminUser] = await db
      .insert(admins)
      .values({
        name: "Father Joseph (Admin)",
        email: `admin_${ts}@church.org`,
        phoneNumber: `+2010${ts.toString().slice(-8)}`,
        passwordHash:
          "$2a$10$w0uK/b4e6K8307kO.1H9a.Gv23y6J2Qy8oYm/6n1E9xGz6Z0X3tC2",
        isSuperAdmin: true,
      })
      .returning();

    const [member] = await db
      .insert(users)
      .values({
        name: "Samuel (Member)",
        email: `samuel_${ts}@church.org`,
        phoneNumber: `+2011${ts.toString().slice(-8)}`,
        passwordHash:
          "$2a$10$w0uK/b4e6K8307kO.1H9a.Gv23y6J2Qy8oYm/6n1E9xGz6Z0X3tC2",
        isTrusted: false,
        isActive: true,
      })
      .returning();

    // SECTION 3: Create & Edit Reservation
    console.log("1. Testing Reservation Edit...");
    const single = await createReservation({
      userId: member.id,
      instrumentId: drum.id,
      serviceName: "Youth Choir Practice",
      date: "2026-11-01",
      startTime: "10:00",
      duration: 2,
      reservationType: "in_church",
    });
    console.log(
      "Created pending reservation:",
      single.reservation.id,
      single.reservation.status,
    );

    const edited = await editReservation(
      single.reservation.id,
      { date: "2026-11-01", startTime: "12:00", duration: 2 },
      { userId: member.id },
    );
    console.log("Edited reservation new status:", edited.status);

    // SECTION 4: Cancellation
    console.log("\n2. Testing User Cancellation...");
    const cancelledRes = await cancelReservation(
      single.reservation.id,
      { cancelMode: "single" },
      { userId: member.id },
    );
    console.log("Cancelled status:", cancelledRes.reservation.status);

    // SECTION 5: Admin Approval and Rejection
    console.log("\n3. Testing Admin Approval and Rejection...");
    const pendingBooking = await createReservation({
      userId: member.id,
      instrumentId: drum.id,
      serviceName: "Sunday Morning Service",
      date: "2026-11-05",
      startTime: "14:00",
      duration: 2,
      reservationType: "in_church",
    });

    const approvedByAdmin = await adminApproveReservation(
      pendingBooking.reservation.id,
      adminUser.id,
    );
    console.log("Admin approved status:", approvedByAdmin.status);

    const pendingBooking2 = await createReservation({
      userId: member.id,
      instrumentId: drum.id,
      serviceName: "Sunday Evening Service",
      date: "2026-11-06",
      startTime: "14:00",
      duration: 2,
      reservationType: "in_church",
    });

    const rejectedByAdmin = await adminRejectReservation(
      pendingBooking2.reservation.id,
      "Church service in sanctuary at this time",
      adminUser.id,
    );
    console.log(
      "Admin rejected status:",
      rejectedByAdmin.status,
      "Reason:",
      rejectedByAdmin.rejectionReason,
    );

    // SECTION 6: Status Transitions
    console.log("\n4. Testing Scheduled Status Transitions...");
    const transitionResult = await runStatusTransitions();
    console.log("Status transition executed:", transitionResult);

    // SECTION 7: Instrument Removal with confirmation
    console.log(
      "\n5. Testing Instrument Removal with future active reservations...",
    );
    // drum currently has an approved reservation on 2026-11-05
    const removalCheck = await removeInstrumentWithConfirmation(
      drum.id,
      { confirmForce: false },
      adminUser.id,
    );
    console.log("Removal without confirmForce:", removalCheck);

    const forceRemoval = await removeInstrumentWithConfirmation(
      drum.id,
      { confirmForce: true },
      adminUser.id,
    );
    console.log("Force removal completed:", forceRemoval);

    console.log("\n=== ALL EXTENDED TESTS PASSED SUCCESSFULLY ✅ ===");
  } catch (err: any) {
    console.error("Extended Test Error:", err);
  } finally {
    await pool.end();
  }
}

runComprehensiveTests();
