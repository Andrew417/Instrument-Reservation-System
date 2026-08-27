import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import { users, admins, failedLoginAttempts, passwordResetOtps, sessions } from '../db/schema.ts';
import { eq, or, and, gt, desc, inArray } from 'drizzle-orm';
import { normalizePhoneNumber } from '../lib/auth-helpers.ts';
import { createSession, validateSession, destroySession, requireAuth } from './session-manager.ts';

const router = Router();

// Inactivity timeout: 30 minutes
// OTP expiration: 10 minutes
const OTP_EXPIRATION_MS = 10 * 60 * 1000;
const MAX_OTP_VERIFY_ATTEMPTS = 3;

// Helper to hash passwords with bcrypt
async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

// Generate normalized telephone variations (+2010..., 010..., 2010...)
function getPhoneVariants(raw: string): string[] {
  const norm = normalizePhoneNumber(raw);
  const variants = new Set<string>();
  variants.add(norm);
  if (norm.startsWith('+')) {
    variants.add(norm.slice(1));
  } else {
    variants.add(`+${norm}`);
  }
  if (norm.startsWith('01') && norm.length === 11) {
    variants.add(`+20${norm.slice(1)}`);
    variants.add(`20${norm.slice(1)}`);
  }
  if (norm.startsWith('+201') && norm.length === 13) {
    variants.add(`0${norm.slice(3)}`);
    variants.add(norm.slice(1));
  }
  if (norm.startsWith('201') && norm.length === 12) {
    variants.add(`0${norm.slice(2)}`);
    variants.add(`+${norm}`);
  }
  return Array.from(variants);
}

// Ensure the hardcoded Super Admin account exists with bcrypt password
export async function ensureSuperAdminSeed(): Promise<void> {
  try {
    const superAdminPhone = '+201000000000';
    const superAdminHash = '$2b$10$s8IYPXA3FueeQ41NOwV7yuhjPNnNosLkDcR/Bjd25RsKXffV2ypKS'; // SuperAdmin@2026

    const variants = getPhoneVariants(superAdminPhone);
    const existing = await db
      .select()
      .from(admins)
      .where(inArray(admins.phoneNumber, variants))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(admins).values({
        name: 'Super Admin (Fr. Joseph)',
        phoneNumber: superAdminPhone,
        passwordHash: superAdminHash,
        isSuperAdmin: true,
      });
      console.log('✅ Hardcoded Super Admin account provisioned: +201000000000 / 01000000000');
    } else {
      // Ensure password hash and isSuperAdmin are up-to-date
      await db
        .update(admins)
        .set({
          name: 'Super Admin (Fr. Joseph)',
          passwordHash: superAdminHash,
          isSuperAdmin: true,
        })
        .where(eq(admins.id, existing[0].id));
      console.log('✅ Hardcoded Super Admin account verified: +201000000000 / 01000000000');
    }
  } catch (err) {
    console.error('Failed to ensure Super Admin seed:', err);
  }
}

// Run initial check
ensureSuperAdminSeed();

/**
 * 1. Check if an account is currently locked due to failed attempts
 */
router.post('/check-lock', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    const result = await db
      .select()
      .from(failedLoginAttempts)
      .where(eq(failedLoginAttempts.phoneNumber, normalized))
      .limit(1);

    if (result.length === 0) {
      res.json({ isLocked: false, consecutiveFailures: 0, attemptsRemaining: 5 });
      return;
    }

    const attempt = result[0];
    const now = new Date();

    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      const remainingMs = attempt.lockedUntil.getTime() - now.getTime();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      res.status(423).json({
        isLocked: true,
        lockedUntil: attempt.lockedUntil.toISOString(),
        remainingSeconds,
        message: `Account is locked due to 5 failed login attempts. Please try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
      });
      return;
    }

    if (attempt.lockedUntil && attempt.lockedUntil <= now) {
      await db
        .update(failedLoginAttempts)
        .set({
          consecutiveFailures: 0,
          lockedUntil: null,
          lastAttemptAt: new Date(),
        })
        .where(eq(failedLoginAttempts.phoneNumber, normalized));
    }

    const failures = attempt.lockedUntil && attempt.lockedUntil <= now ? 0 : attempt.consecutiveFailures;
    res.json({
      isLocked: false,
      consecutiveFailures: failures,
      attemptsRemaining: Math.max(0, 5 - failures),
    });
  } catch (error) {
    console.error('Error checking lock status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 2. Public Member Registration
 * Creates account in users table with bcrypt password hashing and issues session token
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phoneNumber, password } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Full name is required' });
      return;
    }

    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized || normalized.length < 8) {
      res.status(400).json({ error: 'Please enter a valid phone number' });
      return;
    }

    // Check if phone number already registered in users or admins
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, normalized))
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: 'An account with this phone number is already registered. Please log in.' });
      return;
    }

    const [existingAdmin] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.phoneNumber, normalized))
      .limit(1);

    if (existingAdmin) {
      res.status(409).json({ error: 'An account with this phone number is already registered. Please log in.' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        phoneNumber: normalized,
        passwordHash,
        isTrusted: false,
        isActive: true,
      })
      .returning();

    // Clear failed attempts
    await db
      .delete(failedLoginAttempts)
      .where(eq(failedLoginAttempts.phoneNumber, normalized));

    // Create session
    const { token, session } = await createSession(newUser.id, 'user');

    res.status(201).json({
      success: true,
      token,
      profile: session.user,
    });
  } catch (error: any) {
    console.error('Error during registration:', error);
    if (error.code === '23505') {
      res.status(409).json({ error: 'An account with this phone number is already registered. Please log in.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create user account' });
  }
});

/**
 * 3. Member & Admin Login
 * Verifies bcrypt password, enforces 5-attempt rate-limiting with 15-minute lock, issues session token
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      res.status(400).json({ error: 'Phone number and password are required' });
      return;
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    const now = new Date();

    // Check lock status
    const [lockRecord] = await db
      .select()
      .from(failedLoginAttempts)
      .where(eq(failedLoginAttempts.phoneNumber, normalized))
      .limit(1);

    if (lockRecord && lockRecord.lockedUntil && lockRecord.lockedUntil > now) {
      const remainingMs = lockRecord.lockedUntil.getTime() - now.getTime();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      res.status(423).json({
        isLocked: true,
        lockedUntil: lockRecord.lockedUntil.toISOString(),
        remainingSeconds,
        message: `Account is locked for 15 minutes due to 5 consecutive failed attempts. Please try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
      });
      return;
    }

    const variants = getPhoneVariants(phoneNumber);

    // Lookup in users table
    const [matchedUser] = await db
      .select()
      .from(users)
      .where(inArray(users.phoneNumber, variants))
      .limit(1);

    let matchedAccount: any = matchedUser;
    let accountRole: 'user' | 'admin' | 'super_admin' = 'user';

    if (!matchedAccount) {
      // Lookup in admins table
      const [matchedAdmin] = await db
        .select()
        .from(admins)
        .where(inArray(admins.phoneNumber, variants))
        .limit(1);

      if (matchedAdmin) {
        matchedAccount = matchedAdmin;
        accountRole = matchedAdmin.isSuperAdmin ? 'super_admin' : 'admin';
      }
    }

    // Verify bcrypt password
    let passwordMatches = false;
    if (matchedAccount && matchedAccount.passwordHash) {
      passwordMatches = await bcrypt.compare(password, matchedAccount.passwordHash);
    }

    if (!matchedAccount || !passwordMatches) {
      const currentFailures = (lockRecord && (!lockRecord.lockedUntil || lockRecord.lockedUntil <= now)
        ? lockRecord.consecutiveFailures
        : 0) + 1;

      if (currentFailures >= 5) {
        const lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
        await db
          .insert(failedLoginAttempts)
          .values({
            phoneNumber: normalized,
            consecutiveFailures: 5,
            lockedUntil,
            lastAttemptAt: now,
          })
          .onConflictDoUpdate({
            target: failedLoginAttempts.phoneNumber,
            set: {
              consecutiveFailures: 5,
              lockedUntil,
              lastAttemptAt: now,
            },
          });

        res.status(423).json({
          isLocked: true,
          consecutiveFailures: 5,
          lockedUntil: lockedUntil.toISOString(),
          remainingSeconds: 900,
          message: 'Account is locked for 15 minutes due to 5 consecutive failed login attempts.',
        });
        return;
      }

      await db
        .insert(failedLoginAttempts)
        .values({
          phoneNumber: normalized,
          consecutiveFailures: currentFailures,
          lockedUntil: null,
          lastAttemptAt: now,
        })
        .onConflictDoUpdate({
          target: failedLoginAttempts.phoneNumber,
          set: {
            consecutiveFailures: currentFailures,
            lockedUntil: null,
            lastAttemptAt: now,
          },
        });

      const remaining = 5 - currentFailures;
      res.status(401).json({
        isLocked: false,
        consecutiveFailures: currentFailures,
        attemptsRemaining: remaining,
        error: `Invalid phone number or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before 15-minute lock.`,
      });
      return;
    }

    // Check if account active
    if (matchedAccount.isActive === false) {
      res.status(403).json({
        error: 'Your church member account has been deactivated. Please contact church administration.',
      });
      return;
    }

    // Clear failed login attempts
    await db
      .delete(failedLoginAttempts)
      .where(eq(failedLoginAttempts.phoneNumber, normalized));

    // Create session in PostgreSQL
    const { token, session } = await createSession(matchedAccount.id, accountRole);

    res.json({
      success: true,
      token,
      profile: session.user,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

/**
 * 4. Get Current Active Profile & Validate Session
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

    if (!token) {
      res.status(401).json({ error: 'No session token provided' });
      return;
    }

    const { valid, session, error } = await validateSession(token);
    if (!valid || !session) {
      res.status(401).json({ error: error || 'Session expired', isExpired: true });
      return;
    }

    res.json({
      success: true,
      profile: session.user,
      session: {
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 5. Logout
 * Destroys session token in PostgreSQL
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

    if (token) {
      await destroySession(token);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 6. Forgot Password - Step 1: Request SMS OTP
 * Generates secure 6-digit OTP, stores hashed in password_reset_otps table.
 * If external SMS gateway (Twilio) is configured, dispatches real SMS;
 * otherwise logs to console and returns testOtpCode with clear TEST MODE flag.
 */
router.post('/forgot-password/request-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const normalized = normalizePhoneNumber(phoneNumber);

    // Verify phone exists in users or admins
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.phoneNumber, normalized)).limit(1);
    const [a] = await db.select({ id: admins.id }).from(admins).where(eq(admins.phoneNumber, normalized)).limit(1);

    if (!u && !a) {
      res.status(404).json({ error: 'No church member or administrator found with this phone number.' });
      return;
    }

    // Generate secure 6-digit numeric OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = await hashPassword(otpCode);
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

    // Invalidate prior OTPs for this phone
    await db.delete(passwordResetOtps).where(eq(passwordResetOtps.phoneNumber, normalized));

    await db.insert(passwordResetOtps).values({
      phoneNumber: normalized,
      otpHash,
      attempts: 0,
      verified: false,
      expiresAt,
    });

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    let sentRealSms = false;

    if (twilioSid && twilioAuth && twilioFrom) {
      try {
        // Dispatch real SMS via Twilio API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const bodyParams = new URLSearchParams({
          To: normalized,
          From: twilioFrom,
          Body: `Your Church Instrument Reservation verification code is: ${otpCode}. Valid for 10 minutes.`,
        });

        const twilioRes = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: bodyParams.toString(),
        });

        if (twilioRes.ok) {
          sentRealSms = true;
        } else {
          console.warn('Twilio SMS dispatch returned status:', twilioRes.status);
        }
      } catch (smsErr) {
        console.error('Failed to send real SMS via Twilio:', smsErr);
      }
    }

    console.log(`\n========================================`);
    console.log(`[SMS OTP ${sentRealSms ? 'DISPATCHED' : 'TEST MODE'}] Target: ${normalized}`);
    console.log(`[SMS OTP CODE]: ${otpCode} (Expires in 10 minutes)`);
    console.log(`========================================\n`);

    if (sentRealSms) {
      res.json({
        success: true,
        testMode: false,
        message: 'A 6-digit verification code has been sent to your phone via SMS.',
      });
    } else {
      res.json({
        success: true,
        testMode: true,
        testOtpCode: otpCode,
        message: 'A 6-digit verification code has been generated.',
      });
    }
  } catch (error) {
    console.error('Error requesting password reset OTP:', error);
    res.status(500).json({ error: 'Failed to generate verification code' });
  }
});

/**
 * 7. Forgot Password - Step 2: Verify SMS OTP
 */
router.post('/forgot-password/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      res.status(400).json({ error: 'Phone number and verification code are required' });
      return;
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    const now = new Date();

    const [record] = await db
      .select()
      .from(passwordResetOtps)
      .where(and(eq(passwordResetOtps.phoneNumber, normalized), gt(passwordResetOtps.expiresAt, now)))
      .orderBy(desc(passwordResetOtps.createdAt))
      .limit(1);

    if (!record) {
      res.status(400).json({ error: 'Verification code has expired or is invalid. Please request a new code.' });
      return;
    }

    if (record.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      await db.delete(passwordResetOtps).where(eq(passwordResetOtps.id, record.id));
      res.status(429).json({ error: 'Too many incorrect attempts. Please request a new verification code.' });
      return;
    }

    const isValidOtp = await bcrypt.compare(otp.trim(), record.otpHash);

    if (!isValidOtp) {
      const remainingAttempts = MAX_OTP_VERIFY_ATTEMPTS - (record.attempts + 1);
      await db
        .update(passwordResetOtps)
        .set({ attempts: record.attempts + 1 })
        .where(eq(passwordResetOtps.id, record.id));

      res.status(400).json({
        error: `Incorrect code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
        remainingAttempts,
      });
      return;
    }

    // Mark as verified and generate a secure single-use reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    await db
      .update(passwordResetOtps)
      .set({ verified: true, otpHash: await hashPassword(resetToken) })
      .where(eq(passwordResetOtps.id, record.id));

    res.json({
      success: true,
      resetToken,
      message: 'Phone number verified successfully.',
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * 8. Forgot Password - Step 3: Set New Password
 */
router.post('/forgot-password/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, resetToken, newPassword } = req.body;

    if (!phoneNumber || !resetToken || !newPassword) {
      res.status(400).json({ error: 'Phone number, reset token, and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    const normalized = normalizePhoneNumber(phoneNumber);
    const now = new Date();

    const [record] = await db
      .select()
      .from(passwordResetOtps)
      .where(and(eq(passwordResetOtps.phoneNumber, normalized), eq(passwordResetOtps.verified, true), gt(passwordResetOtps.expiresAt, now)))
      .limit(1);

    if (!record) {
      res.status(400).json({ error: 'Reset session has expired or is invalid. Please restart the reset process.' });
      return;
    }

    const tokenValid = await bcrypt.compare(resetToken, record.otpHash);
    if (!tokenValid) {
      res.status(403).json({ error: 'Invalid reset token' });
      return;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update in users or admins
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.phoneNumber, normalized)).limit(1);
    if (u) {
      await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, u.id));
      // Invalidate all prior sessions for security
      await db.delete(sessions).where(eq(sessions.userId, u.id));
    } else {
      const [a] = await db.select({ id: admins.id }).from(admins).where(eq(admins.phoneNumber, normalized)).limit(1);
      if (a) {
        await db.update(admins).set({ passwordHash: newPasswordHash }).where(eq(admins.id, a.id));
        // Invalidate all prior sessions
        await db.delete(sessions).where(eq(sessions.adminId, a.id));
      }
    }

    // Clear failed attempts and OTP record
    await db.delete(failedLoginAttempts).where(eq(failedLoginAttempts.phoneNumber, normalized));
    await db.delete(passwordResetOtps).where(eq(passwordResetOtps.id, record.id));

    res.json({
      success: true,
      message: 'Your password has been reset successfully. You may now log in with your new password.',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
