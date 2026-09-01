-- 0001_initial_schema.sql
-- PostgreSQL Migration for Church Instrument Reservation System
-- Supabase / PostgreSQL compatible with GiST exclusion constraints & RLS

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Helper function to retrieve authenticated user ID from JWT or session setting
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid,
    NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if current actor is admin or service_role
CREATE OR REPLACE FUNCTION is_admin_or_service() RETURNS boolean AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN true;
  END IF;
  IF current_setting('request.jwt.claim.role', true) IN ('service_role', 'admin', 'super_admin') THEN
    RETURN true;
  END IF;
  IF current_setting('app.is_admin', true) = 'true' THEN
    RETURN true;
  END IF;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check reservation hours (9:00 - 22:00 on the same calendar day)
CREATE OR REPLACE FUNCTION check_reservation_hours(tr tstzrange) RETURNS boolean AS $$
BEGIN
  IF tr IS NULL OR isempty(tr) THEN
    RETURN false;
  END IF;
  RETURN (
    (lower(tr) AT TIME ZONE 'Africa/Cairo')::time >= TIME '09:00:00'
    AND (upper(tr) AT TIME ZONE 'Africa/Cairo')::time <= TIME '22:00:00'
    AND (lower(tr) AT TIME ZONE 'Africa/Cairo')::date = (upper(tr) AT TIME ZONE 'Africa/Cairo')::date
    AND lower(tr) < upper(tr)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_trusted BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 2. ADMINS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_super_admin BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 3. INSTRUMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  photo_url TEXT,
  description TEXT,
  outside_fee_per_day NUMERIC DEFAULT 0 NOT NULL,
  booking_mode TEXT NOT NULL CHECK (booking_mode IN ('manual', 'instant')),
  is_removed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 4. RESERVATION SERIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservation_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  instrument_id UUID REFERENCES instruments(id) ON DELETE CASCADE NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('weekly', 'custom')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 5. RESERVATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES reservation_series(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  instrument_id UUID REFERENCES instruments(id) ON DELETE CASCADE NOT NULL,
  time_range TSTZRANGE NOT NULL,
  reservation_type TEXT NOT NULL CHECK (reservation_type IN ('in_church', 'outside_church')),
  fee_snapshot NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','auto_rejected','cancelled','ongoing','completed')),
  rejection_reason TEXT,
  payment_screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Constraint: 9:00 - 22:00 within single day
  CONSTRAINT check_time_window CHECK (check_reservation_hours(time_range)),

  -- Constraint: Structural impossibility of overlapping approved reservations on same instrument
  CONSTRAINT no_approved_overlapping_reservations EXCLUDE USING gist (
    instrument_id WITH =,
    time_range WITH &&
  ) WHERE (status = 'approved')
);

-- ============================================================================
-- 6. MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 7. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 8. HARD LIMITS TABLE (Single row, editable by super admin only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hard_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_active_reservations INT DEFAULT 5 NOT NULL,
  max_reservations_per_day INT DEFAULT 5 NOT NULL,
  max_duration_hours INT DEFAULT 5 NOT NULL,
  max_concurrent_per_type INT DEFAULT 2 NOT NULL,
  max_series_occurrences INT DEFAULT 8 NOT NULL,
  max_submissions_per_hour INT DEFAULT 10 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 9. PAYMENT SETTINGS TABLE (Single row, super admin only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instapay_number TEXT,
  instapay_link TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 10. TRUSTED STATUS AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS trusted_status_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  granted_by_admin_id UUID REFERENCES admins(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('granted','revoked')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- 11. OTP REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================================
-- SEED SINGLE-ROW CONFIG TABLES (IF NOT PRESENT)
-- ============================================================================
INSERT INTO hard_limits (id, max_active_reservations, max_reservations_per_day, max_duration_hours, max_concurrent_per_type, max_series_occurrences, max_submissions_per_hour)
SELECT gen_random_uuid(), 5, 5, 5, 2, 8, 10
WHERE NOT EXISTS (SELECT 1 FROM hard_limits);

INSERT INTO payment_settings (id, instapay_number, instapay_link)
SELECT gen_random_uuid(), NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM payment_settings);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hard_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_status_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;

-- 1. USERS POLICIES
DROP POLICY IF EXISTS "users_read_own_or_admin" ON users;
CREATE POLICY "users_read_own_or_admin" ON users
  FOR SELECT USING (id = app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "users_update_own_or_admin" ON users;
CREATE POLICY "users_update_own_or_admin" ON users
  FOR UPDATE USING (id = app_user_id() OR is_admin_or_service());

-- 2. ADMINS POLICIES (No direct client write; admin/service only)
DROP POLICY IF EXISTS "admins_view_admin_or_service" ON admins;
CREATE POLICY "admins_view_admin_or_service" ON admins
  FOR SELECT USING (is_admin_or_service());

DROP POLICY IF EXISTS "admins_modify_admin_or_service" ON admins;
CREATE POLICY "admins_modify_admin_or_service" ON admins
  FOR ALL USING (is_admin_or_service());

-- 3. INSTRUMENTS POLICIES (Active instruments readable by users; admin full access)
DROP POLICY IF EXISTS "instruments_select_policy" ON instruments;
CREATE POLICY "instruments_select_policy" ON instruments
  FOR SELECT USING (is_removed = false OR is_admin_or_service());

DROP POLICY IF EXISTS "instruments_admin_modify_policy" ON instruments;
CREATE POLICY "instruments_admin_modify_policy" ON instruments
  FOR ALL USING (is_admin_or_service());

-- 4. RESERVATION SERIES POLICIES
DROP POLICY IF EXISTS "series_user_select_policy" ON reservation_series;
CREATE POLICY "series_user_select_policy" ON reservation_series
  FOR SELECT USING (user_id = app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "series_user_insert_policy" ON reservation_series;
CREATE POLICY "series_user_insert_policy" ON reservation_series
  FOR INSERT WITH CHECK (user_id = app_user_id() OR is_admin_or_service());

-- 5. RESERVATIONS POLICIES
DROP POLICY IF EXISTS "reservations_user_select_policy" ON reservations;
CREATE POLICY "reservations_user_select_policy" ON reservations
  FOR SELECT USING (user_id = app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "reservations_user_insert_policy" ON reservations;
CREATE POLICY "reservations_user_insert_policy" ON reservations
  FOR INSERT WITH CHECK (user_id = app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "reservations_user_update_policy" ON reservations;
CREATE POLICY "reservations_user_update_policy" ON reservations
  FOR UPDATE USING (user_id = app_user_id() OR is_admin_or_service());

-- 6. MESSAGES POLICIES (Read-only for users linked to reservation; admin full access)
DROP POLICY IF EXISTS "messages_user_select_policy" ON messages;
CREATE POLICY "messages_user_select_policy" ON messages
  FOR SELECT USING (
    is_admin_or_service() OR
    EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = messages.reservation_id AND r.user_id = app_user_id()
    )
  );

DROP POLICY IF EXISTS "messages_admin_insert_policy" ON messages;
CREATE POLICY "messages_admin_insert_policy" ON messages
  FOR INSERT WITH CHECK (is_admin_or_service());

-- 7. NOTIFICATIONS POLICIES (Users read/update own notifications; admin insert)
DROP POLICY IF EXISTS "notifications_user_select_policy" ON notifications;
CREATE POLICY "notifications_user_select_policy" ON notifications
  FOR SELECT USING (user_id = app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "notifications_user_update_policy" ON notifications;
CREATE POLICY "notifications_user_update_policy" ON notifications
  FOR UPDATE USING (user_id = app_user_id() OR is_admin_or_service());

DROP POLICY IF EXISTS "notifications_admin_insert_policy" ON notifications;
CREATE POLICY "notifications_admin_insert_policy" ON notifications
  FOR INSERT WITH CHECK (is_admin_or_service());

-- 8. HARD LIMITS POLICIES (Readable by users/admins; writable ONLY by super admin / service role)
DROP POLICY IF EXISTS "hard_limits_select_policy" ON hard_limits;
CREATE POLICY "hard_limits_select_policy" ON hard_limits
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hard_limits_admin_modify_policy" ON hard_limits;
CREATE POLICY "hard_limits_admin_modify_policy" ON hard_limits
  FOR ALL USING (is_admin_or_service());

-- 9. PAYMENT SETTINGS POLICIES (Readable by authenticated users; writable ONLY by super admin / service role)
DROP POLICY IF EXISTS "payment_settings_select_policy" ON payment_settings;
CREATE POLICY "payment_settings_select_policy" ON payment_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "payment_settings_admin_modify_policy" ON payment_settings;
CREATE POLICY "payment_settings_admin_modify_policy" ON payment_settings
  FOR ALL USING (is_admin_or_service());

-- 10. TRUSTED STATUS AUDIT LOG POLICIES (Admin / service role only)
DROP POLICY IF EXISTS "audit_log_admin_policy" ON trusted_status_audit_log;
CREATE POLICY "audit_log_admin_policy" ON trusted_status_audit_log
  FOR ALL USING (is_admin_or_service());

-- 11. OTP REQUESTS POLICIES (Service role / backend only)
DROP POLICY IF EXISTS "otp_requests_service_policy" ON otp_requests;
CREATE POLICY "otp_requests_service_policy" ON otp_requests
  FOR ALL USING (is_admin_or_service());
