import assert from "node:assert/strict";

import {
  buildHardLimitsPayload,
  normalizeHardLimitsState,
} from "../src/lib/hard-limits";

const normalized = normalizeHardLimitsState({
  id: "abc",
  bypass_hard_limits: true,
  max_active_reservations: 4,
  max_reservations_per_day: 3,
  max_duration_hours: 2,
  max_concurrent_per_type: 1,
  max_series_occurrences: 6,
  max_submissions_per_hour: 8,
});

assert.equal(normalized.bypassHardLimits, true);
assert.equal(normalized.maxActiveReservations, 4);
assert.equal(normalized.maxSeriesOccurrences, 6);

const payload = buildHardLimitsPayload({
  ...normalized,
  bypassHardLimits: false,
});

assert.equal(payload.bypassHardLimits, false);
assert.equal(payload.bypass_hard_limits, false);
assert.equal(payload.max_active_reservations, 4);

console.log("hard limits bypass tests passed");
