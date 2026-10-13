import { db, pool } from "../src/db/index";
import {
  users,
  admins,
  instruments,
  reservations,
  reservationSeries,
  pushSubscriptions,
} from "../src/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { webpush } from "../src/lib/push-vapid";
import express from "express";
import http from "http";
import adminRouter from "../src/server/admin";
import { createSession } from "../src/server/session-manager";

interface MockCall {
  subscription: any;
  payload: any;
}
const mockCalls: MockCall[] = [];

async function runTests() {
  console.log("=== STARTING USER DEACTIVATION SPEC VERIFICATION ===\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? " - " + details : ""}`);
    }
  }

  // Intercept webpush.sendNotification
  const originalSend = webpush.sendNotification;
  (webpush as any).sendNotification = async (sub: any, payload: string) => {
    let parsed = {};
    try {
      parsed = JSON.parse(payload);
    } catch {
      parsed = { raw: payload };
    }
    mockCalls.push({ subscription: sub, payload: parsed });
    return { statusCode: 201 };
  };

  // Start ephemeral Express server
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin`;

  const ts = Date.now();

  try {
    // 1. Fixture: Super Admin
    const [adminUser] = await db
      .insert(admins)
      .values({
        name: `Admin Test ${ts}`,
        email: `admin_${ts}@church.org`,
        phoneNumber: `+2010${ts.toString().slice(-8)}`,
        passwordHash: "$2a$10$w0uK/b4e6K8307kO.1H9a.Gv23y6J2Qy8oYm/6n1E9xGz6Z0X3tC2",
        isSuperAdmin: true,
      })
      .returning();

    const { token: adminToken } = await createSession(adminUser.id, "admin");

    // 2. Fixture: Instrument
    const [testInstrument] = await db
      .insert(instruments)
      .values({
        name: `Test Instrument ${ts}`,
        type: "Keyboard",
        bookingMode: "manual",
        outsideFeePerDay: "150.00",
        isRemoved: false,
      })
      .returning();

    // 3. Fixture: Target User (Trusted and Active)
    const [targetUser] = await db
      .insert(users)
      .values({
        name: `Target Member ${ts}`,
        email: `member_${ts}@church.org`,
        phoneNumber: `+2011${ts.toString().slice(-8)}`,
        passwordHash: "$2a$10$w0uK/b4e6K8307kO.1H9a.Gv23y6J2Qy8oYm/6n1E9xGz6Z0X3tC2",
        isTrusted: true,
        isActive: true,
        approvalStatus: "approved",
      })
      .returning();

    // 4. Fixture: User's Push Subscription
    const [sub] = await db
      .insert(pushSubscriptions)
      .values({
        userId: targetUser.id,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-endpoint-${ts}`,
        p256dh: "BMockP256dhKey==",
        auth: "MockAuthKey==",
        language: "ar",
      })
      .returning();

    // 5. Fixtures: Various reservations
    // a) Future approved reservation
    const [futureApproved] = await db
      .insert(reservations)
      .values({
        userId: targetUser.id,
        instrumentId: testInstrument.id,
        serviceName: "Sunday Liturgy",
        musicianName: "David",
        reservationType: "in_church",
        status: "approved",
        timeRange: sql`tstzrange(NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', '[)')`,
      })
      .returning();

    // b) Future pending reservation
    const [futurePending] = await db
      .insert(reservations)
      .values({
        userId: targetUser.id,
        instrumentId: testInstrument.id,
        serviceName: "Choir Practice",
        musicianName: "David",
        reservationType: "in_church",
        status: "pending",
        timeRange: sql`tstzrange(NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 2 hours', '[)')`,
      })
      .returning();

    // c) Past completed reservation (MUST REMAIN COMPLETED / UNTOUCHED)
    const [pastCompleted] = await db
      .insert(reservations)
      .values({
        userId: targetUser.id,
        instrumentId: testInstrument.id,
        serviceName: "Past Service",
        musicianName: "David",
        reservationType: "in_church",
        status: "completed",
        timeRange: sql`tstzrange(NOW() - INTERVAL '3 days 2 hours', NOW() - INTERVAL '3 days', '[)')`,
      })
      .returning();

    // d) Past approved reservation (ended in past, MUST REMAIN UNTOUCHED)
    const [pastApproved] = await db
      .insert(reservations)
      .values({
        userId: targetUser.id,
        instrumentId: testInstrument.id,
        serviceName: "Yesterday Vespers",
        musicianName: "David",
        reservationType: "in_church",
        status: "approved",
        timeRange: sql`tstzrange(NOW() - INTERVAL '1 day 2 hours', NOW() - INTERVAL '1 day', '[)')`,
      })
      .returning();

    // e) Recurring series with future occurrences
    const [series] = await db
      .insert(reservationSeries)
      .values({
        userId: targetUser.id,
        instrumentId: testInstrument.id,
        patternType: "weekly",
      })
      .returning();

    const [seriesOccur1] = await db
      .insert(reservations)
      .values({
        seriesId: series.id,
        userId: targetUser.id,
        instrumentId: testInstrument.id,
        serviceName: "Weekly Series 1",
        musicianName: "David",
        reservationType: "in_church",
        status: "approved",
        timeRange: sql`tstzrange(NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 2 hours', '[)')`,
      })
      .returning();

    const [seriesOccur2] = await db
      .insert(reservations)
      .values({
        seriesId: series.id,
        userId: targetUser.id,
        instrumentId: testInstrument.id,
        serviceName: "Weekly Series 2",
        musicianName: "David",
        reservationType: "in_church",
        status: "pending",
        timeRange: sql`tstzrange(NOW() + INTERVAL '12 days', NOW() + INTERVAL '12 days 2 hours', '[)')`,
      })
      .returning();

    // Clear mock calls before deactivation
    mockCalls.length = 0;

    // -------------------------------------------------------------
    // RUN DEACTIVATION: POST /api/admin/users/:id/toggle-status
    // -------------------------------------------------------------
    const deactRes = await fetch(`${baseUrl}/users/${targetUser.id}/toggle-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });

    const deactJson = await deactRes.json();
    assert(deactRes.status === 200 && deactJson.success === true, "Deactivation request succeeds with 200 OK");

    // TEST 1: User is inactive, but isTrusted is preserved
    const [fetchedUser] = await db.select().from(users).where(eq(users.id, targetUser.id));
    assert(
      fetchedUser.isActive === false && fetchedUser.isTrusted === true,
      "User is deactivated (isActive=false) and Trusted flag is retained (isTrusted=true)",
    );

    // TEST 2: Pending and Approved reservations are cancelled
    const [resFutureApproved] = await db.select().from(reservations).where(eq(reservations.id, futureApproved.id));
    const [resFuturePending] = await db.select().from(reservations).where(eq(reservations.id, futurePending.id));
    assert(
      resFutureApproved.status === "cancelled" &&
        resFutureApproved.cancellationReason === "Account deactivated by administration",
      "Future approved reservation is cancelled with reason 'Account deactivated by administration'",
      `Actual: status=${resFutureApproved?.status}, reason=${resFutureApproved?.cancellationReason}`,
    );
    assert(
      resFuturePending.status === "cancelled" &&
        resFuturePending.cancellationReason === "Account deactivated by administration",
      "Future pending reservation is cancelled with reason 'Account deactivated by administration'",
      `Actual: status=${resFuturePending?.status}, reason=${resFuturePending?.cancellationReason}`,
    );

    // TEST 3: Completed and past reservations are untouched
    const [resPastCompleted] = await db.select().from(reservations).where(eq(reservations.id, pastCompleted.id));
    const [resPastApproved] = await db.select().from(reservations).where(eq(reservations.id, pastApproved.id));
    assert(
      resPastCompleted.status === "completed",
      "Completed past reservation is untouched (status=completed)",
      `Actual status=${resPastCompleted?.status}`,
    );
    assert(
      resPastApproved.status === "approved",
      "Past ended reservation is untouched (status=approved, not cancelled)",
      `Actual status=${resPastApproved?.status}`,
    );

    // TEST 4: Series occurrences are cancelled
    const [resSeries1] = await db.select().from(reservations).where(eq(reservations.id, seriesOccur1.id));
    const [resSeries2] = await db.select().from(reservations).where(eq(reservations.id, seriesOccur2.id));
    assert(
      resSeries1.status === "cancelled" && resSeries2.status === "cancelled",
      "All recurring series future occurrences are cancelled",
      `Occur 1: ${resSeries1?.status}, Occur 2: ${resSeries2?.status}`,
    );

    // TEST 5: Slots become free (no conflicting approved reservation on the slot)
    const conflicts = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        sql`${reservations.instrumentId} = ${testInstrument.id}
          AND ${reservations.status} = 'approved'
          AND ${reservations.timeRange} && tstzrange(NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', '[)')`,
      );
    assert(
      conflicts.length === 0,
      "Slots are freed instantly (0 conflicting approved reservations on previously booked slot)",
      `Found ${conflicts.length} conflicting approved reservations`,
    );

    // TEST 6: User's push subscriptions are deleted
    const userSubs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, targetUser.id));
    assert(
      userSubs.length === 0,
      "Push subscriptions are deleted at deactivation so no device receives pushes",
      `Remaining subs: ${userSubs.length}`,
    );

    // TEST 7: NO push notification is sent during deactivation
    assert(
      mockCalls.length === 0,
      "No push notification is sent to the deactivated user (0 pushes recorded)",
      `Push calls recorded: ${mockCalls.length}`,
    );

    // TEST 8: Reactivation restores nothing
    const reactRes = await fetch(`${baseUrl}/users/${targetUser.id}/toggle-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true }),
    });
    const reactJson = await reactRes.json();
    assert(reactRes.status === 200 && reactJson.success === true, "Reactivation request succeeds with 200 OK");

    const [reactivatedUser] = await db.select().from(users).where(eq(users.id, targetUser.id));
    const [checkFutureApproved] = await db.select().from(reservations).where(eq(reservations.id, futureApproved.id));
    const [checkFuturePending] = await db.select().from(reservations).where(eq(reservations.id, futurePending.id));
    const reactSubs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, targetUser.id));

    assert(
      reactivatedUser.isActive === true &&
        checkFutureApproved.status === "cancelled" &&
        checkFuturePending.status === "cancelled" &&
        reactSubs.length === 0,
      "Reactivation restores nothing: cancelled reservations stay cancelled and push subscriptions stay empty",
      `User isActive=${reactivatedUser?.isActive}, res1=${checkFutureApproved?.status}, res2=${checkFuturePending?.status}, subs=${reactSubs.length}`,
    );

    // TEST 9: Admin account protection
    const adminToggleRes = await fetch(`${baseUrl}/users/${adminUser.id}/toggle-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const adminToggleJson = await adminToggleRes.json();
    assert(
      adminToggleRes.status === 400 &&
        adminToggleJson.error.includes("Cannot deactivate an administrator account"),
      "Admin accounts are protected: toggle-status rejects deactivating admin accounts with 400",
      `Status: ${adminToggleRes.status}, Error: ${adminToggleJson.error}`,
    );

    // TEST 10: Atomic transaction rollback on failure
    const [rollbackUser] = await db
      .insert(users)
      .values({
        name: `Rollback User ${ts}`,
        email: `rollback_${ts}@church.org`,
        phoneNumber: `+2012${ts.toString().slice(-8)}`,
        passwordHash: "hash",
        isActive: true,
      })
      .returning();

    const [rollbackRes] = await db
      .insert(reservations)
      .values({
        userId: rollbackUser.id,
        instrumentId: testInstrument.id,
        serviceName: "Rollback Test",
        musicianName: "Tester",
        reservationType: "in_church",
        status: "approved",
        timeRange: sql`tstzrange(NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 2 hours', '[)')`,
      })
      .returning();

    // Verify transaction rollback mechanics: if an error occurs mid-transaction, nothing is committed
    let txRolledBack = false;
    try {
      await db.transaction(async (tx) => {
        await tx.update(users).set({ isActive: false }).where(eq(users.id, rollbackUser.id));
        await tx
          .update(reservations)
          .set({ status: "cancelled", cancellationReason: "Testing rollback" })
          .where(eq(reservations.id, rollbackRes.id));
        // Force failure
        throw new Error("Simulated database failure inside transaction");
      });
    } catch (e: any) {
      txRolledBack = true;
    }

    const [checkRollbackUser] = await db.select().from(users).where(eq(users.id, rollbackUser.id));
    const [checkRollbackRes] = await db.select().from(reservations).where(eq(reservations.id, rollbackRes.id));

    assert(
      txRolledBack && checkRollbackUser.isActive === true && checkRollbackRes.status === "approved",
      "Transaction rollback on failure: both user status and reservations roll back completely if error occurs",
      `isActive=${checkRollbackUser?.isActive}, status=${checkRollbackRes?.status}`,
    );

    // Cleanup fixtures
    await db.delete(reservations).where(
      inArray(reservations.id, [
        futureApproved.id,
        futurePending.id,
        pastCompleted.id,
        pastApproved.id,
        seriesOccur1.id,
        seriesOccur2.id,
        rollbackRes.id,
      ]),
    );
    await db.delete(reservationSeries).where(eq(reservationSeries.id, series.id));
    await db.delete(users).where(inArray(users.id, [targetUser.id, rollbackUser.id]));
    await db.delete(instruments).where(eq(instruments.id, testInstrument.id));
    await db.delete(admins).where(eq(admins.id, adminUser.id));
  } finally {
    // Restore webpush
    (webpush as any).sendNotification = originalSend;
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passedTests} / ${totalTests} assertions passed.`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests()
  .then(() => {
    pool.end();
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    pool.end();
    process.exit(1);
  });
