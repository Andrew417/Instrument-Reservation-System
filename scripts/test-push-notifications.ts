import { db, pool } from "../src/db/index";
import {
  users,
  admins,
  instruments,
  reservations,
  reservationSeries,
  notifications,
  pushSubscriptions,
  adminPushPreferences,
} from "../src/db/schema";
import {
  sendPushToUser,
  sendPushToAdmins,
} from "../src/lib/push-service";
import {
  createReservationSeries,
} from "../src/services/reservation-logic";
import { eq, sql } from "drizzle-orm";
import { webpush } from "../src/lib/push-vapid";
import express from "express";
import http from "http";
import pushRouter from "../src/server/push";
import { createSession } from "../src/server/session-manager";

// Test mock results tracking
interface MockCall {
  subscription: any;
  payload: any;
}
const mockCalls: MockCall[] = [];

// Intercept webpush.sendNotification for testing
const originalSend = webpush.sendNotification;

async function runTests() {
  console.log("=== STARTING WEB PUSH AUTOMATED AUDIT TEST SUITE ===\n");

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

  try {
    // Mock webpush.sendNotification
    (webpush as any).sendNotification = async (
      sub: any,
      payload: string,
    ) => {
      let parsed = {};
      try {
        parsed = JSON.parse(payload);
      } catch {}
      mockCalls.push({ subscription: sub, payload: parsed });

      // Mock expired subscription for specific fake endpoint
      if (sub.endpoint.includes("expired-endpoint-410")) {
        const err: any = new Error("Subscription expired");
        err.statusCode = 410;
        throw err;
      }
      return { statusCode: 201 };
    };

    // 0. Setup test users and admins - clean up any stale mock data first
    await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint LIKE 'https://push.example.com/%'`);
    await db.execute(sql`DELETE FROM admin_push_preferences WHERE admin_id IN (SELECT id FROM admins WHERE email LIKE 'admin_%@example.com')`);
    await db.execute(sql`DELETE FROM admins WHERE email LIKE 'admin_%@example.com'`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE 'test_%@example.com'`);

    const testPhone = `0100${Date.now().toString().slice(-7)}`;
    
    // User 1: Active & Approved, Arabic
    const [activeUserAr] = await db
      .insert(users)
      .values({
        name: "Test User Arabic",
        phoneNumber: testPhone,
        email: `test_user_ar_${Date.now()}@example.com`,
        passwordHash: "hash",
        isActive: true,
        approvalStatus: "approved",
      })
      .returning();

    // User 2: Deactivated
    const [deactivatedUser] = await db
      .insert(users)
      .values({
        name: "Test Deactivated User",
        phoneNumber: `${testPhone}1`,
        email: `test_deact_${Date.now()}@example.com`,
        passwordHash: "hash",
        isActive: false,
        approvalStatus: "approved",
      })
      .returning();

    // User 3: Pending Approval
    const [pendingUser] = await db
      .insert(users)
      .values({
        name: "Test Pending User",
        phoneNumber: `${testPhone}2`,
        email: `test_pend_${Date.now()}@example.com`,
        passwordHash: "hash",
        isActive: true,
        approvalStatus: "pending",
      })
      .returning();

    // Admin 1: All categories ON
    const [adminAllOn] = await db
      .insert(admins)
      .values({
        name: "Admin All On",
        phoneNumber: `${testPhone}3`,
        email: `admin_on_${Date.now()}@example.com`,
        passwordHash: "hash",
        approvalStatus: "approved",
        role: "admin",
      })
      .returning();

    // Admin 2: Muted new_requests
    const [adminMutedRequests] = await db
      .insert(admins)
      .values({
        name: "Admin Muted Requests",
        phoneNumber: `${testPhone}4`,
        email: `admin_muted_${Date.now()}@example.com`,
        passwordHash: "hash",
        approvalStatus: "approved",
        role: "admin",
      })
      .returning();

    await db.insert(adminPushPreferences).values({
      adminId: adminMutedRequests.id,
      notifyNewRequests: false,
      notifyNewRegistrations: true,
      notifyMemberMessages: true,
    });

    // 1. Subscriptions setup
    // User 1 has 2 devices (multi-device): 1 Arabic, 1 English
    await db.insert(pushSubscriptions).values([
      {
        userId: activeUserAr.id,
        endpoint: `https://push.example.com/sub/user-ar-${Date.now()}`,
        p256dh: "mock_p256dh",
        auth: "mock_auth",
        language: "ar",
      },
      {
        userId: activeUserAr.id,
        endpoint: `https://push.example.com/sub/user-en-${Date.now()}`,
        p256dh: "mock_p256dh",
        auth: "mock_auth",
        language: "en",
      },
      // Deactivated user subscription
      {
        userId: deactivatedUser.id,
        endpoint: `https://push.example.com/sub/user-deact-${Date.now()}`,
        p256dh: "mock_p256dh",
        auth: "mock_auth",
        language: "ar",
      },
      // Pending user subscription
      {
        userId: pendingUser.id,
        endpoint: `https://push.example.com/sub/user-pend-${Date.now()}`,
        p256dh: "mock_p256dh",
        auth: "mock_auth",
        language: "ar",
      },
      // Admin 1 subscription
      {
        adminId: adminAllOn.id,
        endpoint: `https://push.example.com/sub/admin-on-${Date.now()}`,
        p256dh: "mock_p256dh",
        auth: "mock_auth",
        language: "ar",
      },
      // Admin 2 subscription
      {
        adminId: adminMutedRequests.id,
        endpoint: `https://push.example.com/sub/admin-muted-${Date.now()}`,
        p256dh: "mock_p256dh",
        auth: "mock_auth",
        language: "en",
      },
      // Expired endpoint for cleanup test
      {
        userId: activeUserAr.id,
        endpoint: `https://push.example.com/sub/expired-endpoint-410-${Date.now()}`,
        p256dh: "mock_p256dh",
        auth: "mock_auth",
        language: "ar",
      },
    ]);

    // -------------------------------------------------------------
    // TEST 1: Recipient Selection & Language Handling
    // -------------------------------------------------------------
    mockCalls.length = 0;
    await sendPushToUser(activeUserAr.id, {
      titleAr: "عنوان عربي",
      titleEn: "English Title",
      bodyAr: "محتوى عربي",
      bodyEn: "English Body",
    });

    const arCalls = mockCalls.filter((c) => c.payload.title === "عنوان عربي");
    const enCalls = mockCalls.filter((c) => c.payload.title === "English Title");
    assert(
      arCalls.length >= 1 && enCalls.length >= 1,
      "Multi-device delivers to both devices with their configured language",
      `Ar calls: ${arCalls.length}, En calls: ${enCalls.length}`,
    );

    // -------------------------------------------------------------
    // TEST 2: Deactivated and Unapproved Users Get Nothing
    // -------------------------------------------------------------
    mockCalls.length = 0;
    const deactRes = await sendPushToUser(deactivatedUser.id, {
      titleAr: "تنبيه",
      titleEn: "Alert",
      bodyAr: "نص",
      bodyEn: "Text",
    });
    assert(
      deactRes.sent === 0 && mockCalls.length === 0,
      "Deactivated user receives 0 push notifications",
    );

    mockCalls.length = 0;
    const pendRes = await sendPushToUser(pendingUser.id, {
      titleAr: "تنبيه",
      titleEn: "Alert",
      bodyAr: "نص",
      bodyEn: "Text",
    });
    assert(
      pendRes.sent === 0 && mockCalls.length === 0,
      "Pending unapproved user receives 0 push notifications",
    );

    // -------------------------------------------------------------
    // TEST 3: Admin Switches Respected & Actor Exclusion
    // -------------------------------------------------------------
    mockCalls.length = 0;
    await sendPushToAdmins(
      {
        titleAr: "طلب حجز جديد",
        titleEn: "New Request",
        bodyAr: "تفاصيل",
        bodyEn: "Details",
      },
      "new_requests",
    );

    // Admin 2 has notifyNewRequests = false, so only Admin 1 should receive it
    const admin1Calls = mockCalls.filter((c) =>
      c.subscription.endpoint.includes("admin-on"),
    );
    const admin2Calls = mockCalls.filter((c) =>
      c.subscription.endpoint.includes("admin-muted"),
    );
    assert(
      admin1Calls.length === 1 && admin2Calls.length === 0,
      "Admin preference switch (notifyNewRequests = false) properly filters out muted admin",
    );

    // Actor exclusion test
    mockCalls.length = 0;
    await sendPushToAdmins(
      {
        titleAr: "رسالة جديدة",
        titleEn: "New Message",
        bodyAr: "محتوى",
        bodyEn: "Body",
      },
      "member_messages",
      adminAllOn.id, // exclude Admin 1
    );
    const admin1Excluded = mockCalls.filter((c) =>
      c.subscription.endpoint.includes("admin-on"),
    );
    assert(
      admin1Excluded.length === 0,
      "Admin actor is excluded when excludeAdminId is passed",
    );

    // -------------------------------------------------------------
    // TEST 3B: Recurring Series = Exactly ONE Admin Push Notification
    // -------------------------------------------------------------
    mockCalls.length = 0;
    const [testInst] = await db
      .insert(instruments)
      .values({
        name: "Test Push Instrument",
        type: "keyboard",
        bookingMode: "manual",
      })
      .returning();

    const d1 = new Date();
    d1.setDate(d1.getDate() + 2);
    const dateStr1 = d1.toISOString().split("T")[0];
    const d2 = new Date();
    d2.setDate(d2.getDate() + 9);
    const dateStr2 = d2.toISOString().split("T")[0];

    const seriesResult = await createReservationSeries({
      userId: activeUserAr.id,
      instrumentId: testInst.id,
      serviceName: "Test Series Push",
      musicianName: "Test Musician",
      patternType: "weekly",
      occurrences: [
        {
          date: dateStr1,
          startTime: "18:00",
          duration: 1,
        },
        {
          date: dateStr2,
          startTime: "18:00",
          duration: 1,
        },
      ],
      reservationType: "in_church",
      feeAcknowledged: true,
    });

    // Brief wait for background push dispatch to complete
    await new Promise((r) => setTimeout(r, 300));

    const seriesAdminCalls = mockCalls.filter((c) =>
      c.subscription.endpoint.includes("admin-on"),
    );
    assert(
      seriesResult.occurrences.length === 2 && seriesAdminCalls.length === 1,
      "Recurring series generates exactly ONE push notification for the whole series (2 occurrences)",
      `Admin calls: ${seriesAdminCalls.length}, occurrences created: ${seriesResult.occurrences.length}`,
    );

    if (seriesResult.series) {
      await db.delete(reservations).where(eq(reservations.seriesId, seriesResult.series.id));
      await db.delete(reservationSeries).where(eq(reservationSeries.id, seriesResult.series.id));
    }
    await db.delete(instruments).where(eq(instruments.id, testInst.id));

    // -------------------------------------------------------------
    // TEST 4: Expired Subscription Cleanup (HTTP 410)
    // -------------------------------------------------------------
    const expiredEp = `https://push.example.com/sub/expired-endpoint-410-test4-${Date.now()}`;
    await db.insert(pushSubscriptions).values({
      userId: activeUserAr.id,
      endpoint: expiredEp,
      p256dh: "mock_p256dh",
      auth: "mock_auth",
      language: "ar",
    });

    const checkExpiredBefore = await db.execute(sql`
      SELECT id FROM push_subscriptions WHERE endpoint = ${expiredEp}
    `);
    const countBefore = (checkExpiredBefore as any).rows?.length || 0;

    // Trigger push which will throw 410 on the expired endpoint
    await sendPushToUser(activeUserAr.id, {
      titleAr: "فحص",
      titleEn: "Check",
      bodyAr: "فحص",
      bodyEn: "Check",
    });

    const checkExpiredAfter = await db.execute(sql`
      SELECT id FROM push_subscriptions WHERE endpoint = ${expiredEp}
    `);
    const countAfter = (checkExpiredAfter as any).rows?.length || 0;
    assert(
      countBefore > 0 && countAfter === 0,
      "Expired subscription (HTTP 410) is automatically deleted from database",
    );

    // -------------------------------------------------------------
    // TEST 5-8: HTTP Endpoints (/unsubscribe & /test security and rate limiting)
    // -------------------------------------------------------------
    const testApp = express();
    testApp.use(express.json());
    testApp.use("/api/push", pushRouter);

    const testServer = http.createServer(testApp);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const testPort = (testServer.address() as any).port;
    const testApiBase = `http://127.0.0.1:${testPort}/api/push`;

    // Create session for activeUserAr and another user
    const [userB] = await db
      .insert(users)
      .values({
        name: "User B",
        phoneNumber: `${testPhone}9`,
        email: `test_user_b_${Date.now()}@example.com`,
        passwordHash: "hash",
        isActive: true,
        approvalStatus: "approved",
      })
      .returning();

    const { token: tokenA } = await createSession(activeUserAr.id, "user");
    const { token: tokenB } = await createSession(userB.id, "user");

    const endpointA = `https://push.example.com/sub/userA-${Date.now()}`;
    const endpointB = `https://push.example.com/sub/userB-${Date.now()}`;

    await db.insert(pushSubscriptions).values([
      {
        userId: activeUserAr.id,
        endpoint: endpointA,
        p256dh: "key_a_p256dh",
        auth: "key_a_auth",
        language: "ar",
      },
      {
        userId: userB.id,
        endpoint: endpointB,
        p256dh: "key_b_p256dh",
        auth: "key_b_auth",
        language: "en",
      },
    ]);

    // Test 5: /unsubscribe without auth is rejected (401)
    const resNoAuth = await fetch(`${testApiBase}/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: endpointA }),
    });
    assert(
      resNoAuth.status === 401,
      "/unsubscribe without auth is rejected",
      `Expected 401, got ${resNoAuth.status}`,
    );

    // Test 6: /unsubscribe cannot delete another account's endpoint
    const resUnsubOther = await fetch(`${testApiBase}/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ endpoint: endpointB }),
    });
    const unsubOtherData = await resUnsubOther.json();
    const [checkB] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpointB));

    assert(
      resUnsubOther.status === 200 && unsubOtherData.deleted === false && Boolean(checkB),
      "/unsubscribe cannot delete another account's endpoint",
      `Deleted: ${unsubOtherData.deleted}, DB row still exists: ${Boolean(checkB)}`,
    );

    // Test 7: /test ignores a body endpoint and only sends to the caller's devices
    mockCalls.length = 0;
    const resTest = await fetch(`${testApiBase}/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ endpoint: endpointB, language: "ar" }),
    });
    const resTestData = await resTest.json();
    const callsToB = mockCalls.filter((c) => c.subscription.endpoint === endpointB);
    const callsToA = mockCalls.filter((c) => c.subscription.endpoint === endpointA);

    assert(
      resTest.status === 200 && resTestData.success === true && callsToB.length === 0 && callsToA.length === 1,
      "/test ignores a body endpoint and only sends to the caller's devices",
      `Calls to A: ${callsToA.length}, Calls to B: ${callsToB.length}`,
    );

    // Test 8: /test rate limit (returns 429 after 3 requests in a 60-second window)
    await fetch(`${testApiBase}/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({}),
    });
    await fetch(`${testApiBase}/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({}),
    });
    const resRateLimited = await fetch(`${testApiBase}/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({}),
    });

    assert(
      resRateLimited.status === 429,
      "/test rate limit",
      `Expected 429, got ${resRateLimited.status}`,
    );

    testServer.close();
    await db.execute(sql`DELETE FROM push_subscriptions WHERE user_id = ${userB.id}`);
    await db.delete(users).where(eq(users.id, userB.id));

    // -------------------------------------------------------------
    // Clean up test records
    // -------------------------------------------------------------
    await db.execute(sql`DELETE FROM push_subscriptions WHERE user_id = ${activeUserAr.id}`);
    await db.execute(sql`DELETE FROM push_subscriptions WHERE user_id = ${deactivatedUser.id}`);
    await db.execute(sql`DELETE FROM push_subscriptions WHERE user_id = ${pendingUser.id}`);
    await db.execute(sql`DELETE FROM push_subscriptions WHERE admin_id = ${adminAllOn.id}`);
    await db.execute(sql`DELETE FROM push_subscriptions WHERE admin_id = ${adminMutedRequests.id}`);
    await db.delete(adminPushPreferences).where(eq(adminPushPreferences.adminId, adminMutedRequests.id));
    await db.delete(users).where(eq(users.id, activeUserAr.id));
    await db.delete(users).where(eq(users.id, deactivatedUser.id));
    await db.delete(users).where(eq(users.id, pendingUser.id));
    await db.delete(admins).where(eq(admins.id, adminAllOn.id));
    await db.delete(admins).where(eq(admins.id, adminMutedRequests.id));

    console.log(`\n=== RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===\n`);
  } catch (err: any) {
    console.error("Test execution failed:", err);
  } finally {
    // Restore original
    webpush.sendNotification = originalSend;
    await pool.end();
  }
}

runTests();
