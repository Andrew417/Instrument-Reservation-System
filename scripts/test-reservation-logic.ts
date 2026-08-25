import { db, pool } from '../src/db/index.ts';
import {
  users,
  admins,
  instruments,
  reservations,
  reservationSeries,
  notifications,
  hardLimits,
} from '../src/db/schema.ts';
import {
  createReservation,
  createReservationSeries,
  evaluateReservationSubmission,
  buildTimeRange,
  getHardLimits,
} from '../src/services/reservation-logic.ts';
import { eq, sql } from 'drizzle-orm';

async function runTests() {
  console.log('=== STARTING RESERVATION BUSINESS LOGIC TEST SUITE ===\n');

  try {
    // 0. Clean test records if any exist
    await db.delete(notifications);
    await db.delete(reservations);
    await db.delete(reservationSeries);
    await db.delete(instruments);
    await db.delete(users);
    await db.delete(admins);

    // 1. Setup Hard Limits (default: maxActiveReservations = 5, maxSeriesOccurrences = 8, etc.)
    const [limits] = await db
      .insert(hardLimits)
      .values({
        maxActiveReservations: 5,
        maxReservationsPerDay: 5,
        maxDurationHours: 5,
        maxConcurrentPerType: 2,
        maxSeriesOccurrences: 8,
        maxSubmissionsPerHour: 10,
      })
      .onConflictDoUpdate({
        target: hardLimits.id,
        set: {
          maxActiveReservations: 5,
          maxReservationsPerDay: 5,
          maxDurationHours: 5,
          maxConcurrentPerType: 2,
          maxSeriesOccurrences: 8,
          maxSubmissionsPerHour: 10,
        },
      })
      .returning();

    // 2. Setup Test Instruments
    const [manualPiano] = await db
      .insert(instruments)
      .values({
        name: 'Grand Piano (Sanctuary)',
        type: 'Keyboard',
        bookingMode: 'manual',
        outsideFeePerDay: '500.00',
        isRemoved: false,
      })
      .returning();

    const [instantGuitar] = await db
      .insert(instruments)
      .values({
        name: 'Acoustic Guitar #1',
        type: 'Strings',
        bookingMode: 'instant',
        outsideFeePerDay: '150.00',
        isRemoved: false,
      })
      .returning();

    // 3. Setup Test Users
    const [trustedUser] = await db
      .insert(users)
      .values({
        name: 'David (Trusted Choirmaster)',
        phoneNumber: '+201011111111',
        passwordHash: '$2a$10$w0uK/b4e6K8307kO.1H9a.Gv23y6J2Qy8oYm/6n1E9xGz6Z0X3tC2',
        isTrusted: true,
        isActive: true,
      })
      .returning();

    const [regularUser] = await db
      .insert(users)
      .values({
        name: 'Peter (Regular Member)',
        phoneNumber: '+201022222222',
        passwordHash: '$2a$10$w0uK/b4e6K8307kO.1H9a.Gv23y6J2Qy8oYm/6n1E9xGz6Z0X3tC2',
        isTrusted: false,
        isActive: true,
      })
      .returning();

    const [secondUser] = await db
      .insert(users)
      .values({
        name: 'Mark (Second Member)',
        phoneNumber: '+201033333333',
        passwordHash: '$2a$10$w0uK/b4e6K8307kO.1H9a.Gv23y6J2Qy8oYm/6n1E9xGz6Z0X3tC2',
        isTrusted: false,
        isActive: true,
      })
      .returning();

    console.log('Test fixtures created successfully:');
    console.log(`- Manual Instrument: ${manualPiano.name} (${manualPiano.id}) [mode: ${manualPiano.bookingMode}]`);
    console.log(`- Instant Instrument: ${instantGuitar.name} (${instantGuitar.id}) [mode: ${instantGuitar.bookingMode}]`);
    console.log(`- Trusted User: ${trustedUser.name} (${trustedUser.id}) [isTrusted: ${trustedUser.isTrusted}]`);
    console.log(`- Regular User: ${regularUser.name} (${regularUser.id}) [isTrusted: ${regularUser.isTrusted}]\n`);

    // =========================================================================
    // TEST CASE 1: A Trusted user booking a Manual-mode instrument
    // EXPECTED: Should auto-approve (status = 'approved')
    // =========================================================================
    console.log('------------------------------------------------------------');
    console.log('TEST 1: A Trusted user booking a Manual-mode instrument');
    console.log('------------------------------------------------------------');
    const test1Result = await createReservation({
      userId: trustedUser.id,
      instrumentId: manualPiano.id,
      date: '2026-09-01',
      startTime: '10:00',
      duration: 2,
      reservationType: 'in_church',
    });

    console.log('Result:', {
      reservationId: test1Result.reservation.id,
      status: test1Result.reservation.status,
      reasons: test1Result.evaluation.reasons,
      isTrustedOrAdmin: test1Result.evaluation.isTrustedOrAdmin,
    });
    console.log(`Assertion Test 1 (status === 'approved'):`, test1Result.reservation.status === 'approved' ? 'PASSED ✅' : 'FAILED ❌');
    console.log();

    // =========================================================================
    // TEST CASE 2: A regular user over max_active_reservations booking an Instant-mode instrument with no conflict
    // EXPECTED: Should be Pending, not approved
    // =========================================================================
    console.log('------------------------------------------------------------');
    console.log('TEST 2: Regular user over max_active_reservations booking Instant instrument');
    console.log('------------------------------------------------------------');
    // First, fill up regularUser's active reservations to max_active_reservations (5)
    console.log('Creating 5 distinct active reservations to reach max limit (5)...');
    for (let i = 1; i <= 5; i++) {
      await createReservation({
        userId: regularUser.id,
        instrumentId: instantGuitar.id,
        date: `2026-09-0${i + 1}`,
        startTime: '10:00',
        duration: 1,
        reservationType: 'in_church',
      });
    }

    // Now attempt 6th reservation on instant instrument on a new date (no conflict)
    console.log('Submitting 6th reservation for regularUser...');
    const test2Result = await createReservation({
      userId: regularUser.id,
      instrumentId: instantGuitar.id,
      date: '2026-09-10',
      startTime: '14:00',
      duration: 1,
      reservationType: 'in_church',
    });

    console.log('Result:', {
      reservationId: test2Result.reservation.id,
      status: test2Result.reservation.status,
      reasons: test2Result.evaluation.reasons,
    });
    console.log(`Assertion Test 2 (status === 'pending'):`, test2Result.reservation.status === 'pending' ? 'PASSED ✅' : 'FAILED ❌');
    console.log();

    // =========================================================================
    // TEST CASE 3: Two overlapping submissions for the same instant-mode instrument, same slot
    // EXPECTED: Second one should be blocked outright
    // =========================================================================
    console.log('------------------------------------------------------------');
    console.log('TEST 3: Two overlapping submissions for same instant instrument, same slot');
    console.log('------------------------------------------------------------');
    // Submission A (from secondUser who is under limit, Instant instrument -> auto-approved)
    console.log('User A submits booking on 2026-09-15 11:00 - 13:00 (2 hours)...');
    const firstSubmission = await createReservation({
      userId: secondUser.id,
      instrumentId: instantGuitar.id,
      date: '2026-09-15',
      startTime: '11:00',
      duration: 2,
      reservationType: 'in_church',
    });
    console.log(`User A Submission Status: ${firstSubmission.reservation.status} (ID: ${firstSubmission.reservation.id})`);

    // Submission B (from trustedUser or regularUser for the overlapping time 12:00 - 14:00)
    console.log('User B attempts overlapping booking on 2026-09-15 12:00 - 14:00...');
    let secondSubmissionBlocked = false;
    let errorMessage = '';
    try {
      await createReservation({
        userId: trustedUser.id, // even trusted user must be blocked on approved conflict
        instrumentId: instantGuitar.id,
        date: '2026-09-15',
        startTime: '12:00',
        duration: 2,
        reservationType: 'in_church',
      });
    } catch (err: any) {
      secondSubmissionBlocked = true;
      errorMessage = err.message;
    }

    console.log('Result:', {
      blockedOutright: secondSubmissionBlocked,
      error: errorMessage,
    });
    console.log(`Assertion Test 3 (Second overlapping booking blocked outright):`, secondSubmissionBlocked ? 'PASSED ✅' : 'FAILED ❌');
    console.log();

    // =========================================================================
    // TEST CASE 4: A recurring series where occurrence 3 of 5 conflicts with itself (occurrence 3 and 4 overlap)
    // EXPECTED: Should block entire submission with both conflicting dates listed
    // =========================================================================
    console.log('------------------------------------------------------------');
    console.log('TEST 4: Recurring series with self-overlapping occurrences (3 and 4)');
    console.log('------------------------------------------------------------');
    const occurrencesWithSelfOverlap = [
      { date: '2026-10-01', startTime: '10:00', duration: 2 }, // Occ 1: Oct 1 10:00 - 12:00
      { date: '2026-10-08', startTime: '10:00', duration: 2 }, // Occ 2: Oct 8 10:00 - 12:00
      { date: '2026-10-15', startTime: '10:00', duration: 3 }, // Occ 3: Oct 15 10:00 - 13:00 (overlaps Occ 4)
      { date: '2026-10-15', startTime: '12:00', duration: 2 }, // Occ 4: Oct 15 12:00 - 14:00 (overlaps Occ 3)
      { date: '2026-10-22', startTime: '10:00', duration: 2 }, // Occ 5: Oct 22 10:00 - 12:00
    ];

    let seriesBlocked = false;
    let seriesErrorMessage = '';

    try {
      await createReservationSeries({
        userId: trustedUser.id,
        instrumentId: manualPiano.id,
        patternType: 'custom',
        occurrences: occurrencesWithSelfOverlap,
        reservationType: 'in_church',
      });
    } catch (err: any) {
      seriesBlocked = true;
      seriesErrorMessage = err.message;
    }

    console.log('Result:', {
      blockedOutright: seriesBlocked,
      errorMessage: seriesErrorMessage,
    });
    const hasBothOccurrencesInError =
      seriesErrorMessage.includes('Occurrence #3') &&
      seriesErrorMessage.includes('Occurrence #4') &&
      seriesErrorMessage.includes('2026-10-15');

    console.log(`Assertion Test 4 (Blocked with detailed dates/occurrences):`, seriesBlocked && hasBothOccurrencesInError ? 'PASSED ✅' : 'FAILED ❌');
    console.log();

    console.log('=== ALL 4 TEST CASES COMPLETED ===');
  } catch (globalErr: any) {
    console.error('Test Suite Exception:', globalErr);
  } finally {
    await pool.end();
  }
}

runTests();
