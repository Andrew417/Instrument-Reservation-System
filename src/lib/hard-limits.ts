export type HardLimitsState = {
  id?: string;
  maxActiveReservations: number;
  maxReservationsPerDay: number;
  maxDurationHours: number;
  maxConcurrentPerType: number;
  maxSeriesOccurrences: number;
  maxSubmissionsPerHour: number;
  bypassHardLimits: boolean;
  hardLimitsEnabled: boolean;
};

export function normalizeHardLimitsState(limits: any): HardLimitsState {
  const bypass = Boolean(
    limits?.bypassHardLimits ?? limits?.bypass_hard_limits ?? false,
  );

  return {
    id: limits?.id,
    maxActiveReservations: Number(
      limits?.maxActiveReservations ?? limits?.max_active_reservations ?? 5,
    ),
    maxReservationsPerDay: Number(
      limits?.maxReservationsPerDay ?? limits?.max_reservations_per_day ?? 5,
    ),
    maxDurationHours: Number(
      limits?.maxDurationHours ?? limits?.max_duration_hours ?? 5,
    ),
    maxConcurrentPerType: Number(
      limits?.maxConcurrentPerType ?? limits?.max_concurrent_per_type ?? 2,
    ),
    maxSeriesOccurrences: Number(
      limits?.maxSeriesOccurrences ?? limits?.max_series_occurrences ?? 8,
    ),
    maxSubmissionsPerHour: Number(
      limits?.maxSubmissionsPerHour ?? limits?.max_submissions_per_hour ?? 10,
    ),
    bypassHardLimits: bypass,
    hardLimitsEnabled: !bypass,
  };
}

export function buildHardLimitsPayload(state: any) {
  const payload = {
    maxActiveReservations: Number(state?.maxActiveReservations ?? 1) || 1,
    maxReservationsPerDay: Number(state?.maxReservationsPerDay ?? 1) || 1,
    maxDurationHours: Number(state?.maxDurationHours ?? 1) || 1,
    maxConcurrentPerType: Number(state?.maxConcurrentPerType ?? 1) || 1,
    maxSeriesOccurrences: Number(state?.maxSeriesOccurrences ?? 2) || 2,
    maxSubmissionsPerHour: Number(state?.maxSubmissionsPerHour ?? 5) || 5,
    max_active_reservations: Number(state?.maxActiveReservations ?? 1) || 1,
    max_reservations_per_day: Number(state?.maxReservationsPerDay ?? 1) || 1,
    max_duration_hours: Number(state?.maxDurationHours ?? 1) || 1,
    max_concurrent_per_type: Number(state?.maxConcurrentPerType ?? 1) || 1,
    max_series_occurrences: Number(state?.maxSeriesOccurrences ?? 2) || 2,
    max_submissions_per_hour: Number(state?.maxSubmissionsPerHour ?? 5) || 5,
    bypassHardLimits: Boolean(state?.bypassHardLimits ?? false),
    bypass_hard_limits: Boolean(state?.bypassHardLimits ?? false),
  };

  return payload;
}
