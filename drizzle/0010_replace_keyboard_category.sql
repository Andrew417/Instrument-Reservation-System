UPDATE instruments
SET type = 'Piano'
WHERE LOWER(TRIM(type)) IN ('keyboard', 'keyboards');

UPDATE instrument_type_settings
SET type = 'Piano'
WHERE LOWER(TRIM(type)) IN ('keyboard', 'keyboards')
  AND NOT EXISTS (
    SELECT 1
    FROM instrument_type_settings
    WHERE LOWER(TRIM(type)) = 'piano'
  );

DELETE FROM instrument_type_settings
WHERE LOWER(TRIM(type)) IN ('keyboard', 'keyboards');

UPDATE reservations
SET requested_type = 'Piano'
WHERE LOWER(TRIM(requested_type)) IN ('keyboard', 'keyboards');

UPDATE reservation_series
SET requested_type = 'Piano'
WHERE LOWER(TRIM(requested_type)) IN ('keyboard', 'keyboards');
