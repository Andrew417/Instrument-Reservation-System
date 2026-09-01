ALTER TABLE password_reset_otps
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN request_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN window_start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD CONSTRAINT password_reset_otps_email_key UNIQUE (email);