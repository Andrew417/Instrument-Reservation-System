import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import { db } from "../db/index";
import {
  users,
  admins,
  failedLoginAttempts,
  passwordResetOtps,
  sessions,
} from "../db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import {
  normalizeEmail,
  normalizePhoneNumber,
  isValidEmail,
} from "../lib/auth-helpers";
import {
  createSession,
  validateSession,
  destroySession,
} from "./session-manager";

const router = Router();

// OTP settings
const OTP_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds rate limit
const MAX_OTP_VERIFY_ATTEMPTS = 3;

// Lazy initialization of Resend client
let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey.trim());
  }
  return resendClient;
}

// Helper to hash passwords / tokens with bcrypt
async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

/**
 * 1. Check if an account is currently locked due to failed attempts
 */
router.post(
  "/check-lock",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawEmail = req.body.email || req.body.phoneNumber || "";
      const normalized = normalizeEmail(rawEmail);

      if (!normalized) {
        res.status(400).json({ error: "Email address is required" });
        return;
      }

      const result = await db
        .select()
        .from(failedLoginAttempts)
        .where(eq(failedLoginAttempts.email, normalized))
        .limit(1);

      if (result.length === 0) {
        res.json({
          isLocked: false,
          consecutiveFailures: 0,
          attemptsRemaining: 5,
        });
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
          .where(eq(failedLoginAttempts.email, normalized));
      }

      const failures =
        attempt.lockedUntil && attempt.lockedUntil <= now
          ? 0
          : attempt.consecutiveFailures;
      res.json({
        isLocked: false,
        consecutiveFailures: failures,
        attemptsRemaining: Math.max(0, 5 - failures),
      });
    } catch (error) {
      console.error("Error checking lock status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * 2. Public Member Registration
 * Accepts: email, phoneNumber, name, password
 * Creates pending account in users table
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Full name is required" });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      res.status(400).json({ error: "Please enter a valid email address" });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber || "");
    if (!normalizedPhone || normalizedPhone.length < 8) {
      res.status(400).json({ error: "Please enter a valid phone number" });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    // Check if email already registered in users table
    const [existingUser] = await db
      .select({ id: users.id, approvalStatus: users.approvalStatus })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      if (existingUser.approvalStatus === "pending") {
        res
          .status(409)
          .json({
            error:
              "An account with this email has already registered and is currently awaiting admin approval.",
          });
        return;
      }
      if (existingUser.approvalStatus === "rejected") {
        res
          .status(409)
          .json({
            error:
              "An account with this email was previously reviewed and not approved. Please contact church administration.",
          });
        return;
      }
      res
        .status(409)
        .json({
          error:
            "An account with this email is already registered. Please log in.",
        });
      return;
    }

    // Check if email registered in admins table
    const [existingAdmin] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.email, normalizedEmail))
      .limit(1);

    if (existingAdmin) {
      res
        .status(409)
        .json({
          error:
            "An account with this email is already registered. Please log in.",
        });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        passwordHash,
        isTrusted: false,
        isActive: false, // New accounts are pending approval
        approvalStatus: "pending",
      })
      .returning();

    // Clear any stale failed attempts for this email
    await db
      .delete(failedLoginAttempts)
      .where(eq(failedLoginAttempts.email, normalizedEmail));

    res.status(201).json({
      success: true,
      pendingApproval: true,
      message:
        "Registration submitted. Your account is awaiting admin approval before you can log in",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        approvalStatus: newUser.approvalStatus,
      },
    });
  } catch (error: any) {
    console.error("Error during registration:", error);
    if (error.code === "23505") {
      res
        .status(409)
        .json({
          error:
            "An account with this email is already registered. Please log in.",
        });
      return;
    }
    res.status(500).json({ error: "Failed to create user account" });
  }
});

/**
 * 3. Member & Admin Login
 * Uses email as unique identifier
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawEmail = req.body.email || req.body.phoneNumber;
    const password = req.body.password;

    if (!rawEmail || !password) {
      res
        .status(400)
        .json({ error: "Email address and password are required" });
      return;
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    const now = new Date();

    // Check lock status in failed_login_attempts
    const [lockRecord] = await db
      .select()
      .from(failedLoginAttempts)
      .where(eq(failedLoginAttempts.email, normalizedEmail))
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

    // Lookup in users table by email
    const [matchedUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (matchedUser) {
      if (matchedUser.approvalStatus === "pending") {
        res.status(403).json({
          success: false,
          error: "Your account is awaiting admin approval.",
          approvalStatus: "pending",
        });
        return;
      }

      if (matchedUser.approvalStatus === "rejected") {
        res.status(403).json({
          success: false,
          error:
            "Your account registration was not approved. Please contact church administration.",
          approvalStatus: "rejected",
        });
        return;
      }
    }

    let matchedAccount: any = matchedUser;
    let accountRole: "user" | "admin" | "super_admin" = "user";

    if (!matchedAccount) {
      // Lookup in admins table by email
      const [matchedAdmin] = await db
        .select()
        .from(admins)
        .where(eq(admins.email, normalizedEmail))
        .limit(1);

      if (matchedAdmin) {
        matchedAccount = matchedAdmin;
        accountRole = matchedAdmin.isSuperAdmin ? "super_admin" : "admin";
      }
    }

    // Verify bcrypt password
    let passwordMatches = false;
    if (matchedAccount && matchedAccount.passwordHash) {
      passwordMatches = await bcrypt.compare(
        password,
        matchedAccount.passwordHash,
      );
    }

    if (!matchedAccount || !passwordMatches) {
      const currentFailures =
        (lockRecord &&
        (!lockRecord.lockedUntil || lockRecord.lockedUntil <= now)
          ? lockRecord.consecutiveFailures
          : 0) + 1;

      if (currentFailures >= 5) {
        const lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
        await db
          .insert(failedLoginAttempts)
          .values({
            email: normalizedEmail,
            consecutiveFailures: 5,
            lockedUntil,
            lastAttemptAt: now,
          })
          .onConflictDoUpdate({
            target: failedLoginAttempts.email,
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
          message:
            "Account is locked for 15 minutes due to 5 consecutive failed login attempts.",
        });
        return;
      }

      await db
        .insert(failedLoginAttempts)
        .values({
          email: normalizedEmail,
          consecutiveFailures: currentFailures,
          lockedUntil: null,
          lastAttemptAt: now,
        })
        .onConflictDoUpdate({
          target: failedLoginAttempts.email,
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
        error: `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before 15-minute lock.`,
      });
      return;
    }

    // Check if account is active
    if (matchedAccount.isActive === false) {
      res.status(403).json({
        error:
          "Your church member account has been deactivated. Please contact church administration.",
      });
      return;
    }

    // Clear failed login attempts on successful login
    await db
      .delete(failedLoginAttempts)
      .where(eq(failedLoginAttempts.email, normalizedEmail));

    // Create session in PostgreSQL
    const { token, session } = await createSession(
      matchedAccount.id,
      accountRole,
    );

    res.json({
      success: true,
      token,
      profile: session.user,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal server error during login" });
  }
});

/**
 * 4. Get Current Active Profile & Validate Session
 */
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : (req.headers["x-session-token"] as string);

    if (!token) {
      res.status(401).json({ error: "No session token provided" });
      return;
    }

    const { valid, session, error } = await validateSession(token);
    if (!valid || !session) {
      res
        .status(401)
        .json({ error: error || "Session expired", isExpired: true });
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
    console.error("Error fetching active session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 5. Logout
 */
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : (req.headers["x-session-token"] as string);

    if (token) {
      await destroySession(token);
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Helper to send email OTP via Resend
 */
async function sendOtpEmail(
  email: string,
  otpCode: string,
): Promise<{ sent: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    return { sent: false };
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "St. Mark Reservations <onboarding@resend.dev>";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fcfbf9; margin: 0; padding: 24px; color: #292524; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { display: inline-block; font-size: 28px; line-height: 1; margin-bottom: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #1c1917; margin: 0; }
          .subtitle { font-size: 13px; color: #78716c; margin-top: 4px; }
          .body-text { font-size: 14px; line-height: 1.6; color: #44403c; margin: 16px 0; }
          .otp-container { background: #fdf8f4; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #9a3412; margin: 0; }
          .otp-expiry { font-size: 12px; color: #c2410c; margin-top: 8px; font-weight: 600; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #f5f5f4; font-size: 12px; color: #a8a29e; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">⛪</div>
            <h1 class="title">Password Reset Code</h1>
            <div class="subtitle">St. Mark Church Instrument Reservation</div>
          </div>
          <p class="body-text">
            We received a request to reset your password. Use the 6-digit verification code below to verify your identity:
          </p>
          <div class="otp-container">
            <div class="otp-code">${otpCode}</div>
            <div class="otp-expiry">⏱️ Valid for 10 minutes</div>
          </div>
          <p class="body-text">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <div class="footer">
            St. Mark Church Instrument Reservation System<br>
            Secure Church Member Portal
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `${otpCode} is your Password Reset Code - St. Mark Church`,
      html: htmlContent,
    });

    if (error) {
      console.warn("Resend email error:", error);
      return { sent: false, error: error.message };
    }

    return { sent: true };
  } catch (err: any) {
    console.error("Error invoking Resend email API:", err);
    return { sent: false, error: err.message };
  }
}

/**
 * 6. Forgot Password - Step 1: Request OTP by Email
 * Generates numeric 6-digit OTP, stores hashed in password_reset_otps table.
 * Dispatches real email via Resend if RESEND_API_KEY is configured.
 * Implements 60-second rate-limiting per email address.
 */
router.post(
  "/forgot-password/request-otp",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawEmail = req.body.email || req.body.phoneNumber || "";
      const normalizedEmail = normalizeEmail(rawEmail);

      if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
        res.status(400).json({ error: "Please enter a valid email address" });
        return;
      }

      // Verify email exists in users or admins
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      const [a] = await db
        .select({ id: admins.id })
        .from(admins)
        .where(eq(admins.email, normalizedEmail))
        .limit(1);

      if (!u && !a) {
        res
          .status(404)
          .json({
            error:
              "No church member or administrator account found with this email address.",
          });
        return;
      }

      const now = new Date();

      // Check rate limiting: max 1 request per 60 seconds per email
      const [existingOtp] = await db
        .select()
        .from(passwordResetOtps)
        .where(eq(passwordResetOtps.email, normalizedEmail))
        .orderBy(desc(passwordResetOtps.createdAt))
        .limit(1);

      if (existingOtp) {
        const timeSinceLastRequest =
          now.getTime() - new Date(existingOtp.lastRequestedAt).getTime();
        if (timeSinceLastRequest < OTP_RESEND_COOLDOWN_MS) {
          const remainingSeconds = Math.ceil(
            (OTP_RESEND_COOLDOWN_MS - timeSinceLastRequest) / 1000,
          );
          res.status(429).json({
            error: `Please wait ${remainingSeconds} second(s) before requesting a new code.`,
            retryAfterSeconds: remainingSeconds,
          });
          return;
        }
      }

      // Generate secure 6-digit numeric OTP
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpHash = await hashPassword(otpCode);
      const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MS);

      // Invalidate prior OTPs for this email
      await db
        .delete(passwordResetOtps)
        .where(eq(passwordResetOtps.email, normalizedEmail));

      // Store new OTP
      await db.insert(passwordResetOtps).values({
        email: normalizedEmail,
        otpHash,
        attempts: 0,
        verified: false,
        expiresAt,
        lastRequestedAt: now,
      });

      // Send email via Resend
      const { sent: emailSent, error: emailError } = await sendOtpEmail(
        normalizedEmail,
        otpCode,
      );

      console.log(`\n========================================`);
      console.log(
        `[EMAIL OTP ${emailSent ? "SENT VIA RESEND" : "TEST/DEV MODE"}] Target: ${normalizedEmail}`,
      );
      console.log(`[EMAIL OTP CODE]: ${otpCode} (Expires in 10 minutes)`);
      if (emailError) console.log(`[RESEND NOTICE]: ${emailError}`);
      console.log(`========================================\n`);

      if (emailSent) {
        res.json({
          success: true,
          emailSent: true,
          testMode: false,
          message:
            "A 6-digit verification code has been sent to your email address.",
        });
      } else {
        res.json({
          success: true,
          emailSent: false,
          testMode: true,
          testOtpCode: otpCode,
          message: "A 6-digit verification code has been generated.",
        });
      }
    } catch (error) {
      console.error("Error requesting password reset OTP:", error);
      res.status(500).json({ error: "Failed to generate verification code" });
    }
  },
);

/**
 * 7. Forgot Password - Resend OTP Endpoint
 * Invalidates any previous unexpired OTP for that email, generates and sends a new one.
 * Includes 60s rate-limiting.
 */
router.post(
  "/forgot-password/resend-otp",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawEmail = req.body.email || req.body.phoneNumber || "";
      const normalizedEmail = normalizeEmail(rawEmail);

      if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
        res.status(400).json({ error: "Please enter a valid email address" });
        return;
      }

      // Verify account exists
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      const [a] = await db
        .select({ id: admins.id })
        .from(admins)
        .where(eq(admins.email, normalizedEmail))
        .limit(1);

      if (!u && !a) {
        res
          .status(404)
          .json({ error: "No account found with this email address." });
        return;
      }

      const now = new Date();

      // Check rate limit: 60s
      const [existingOtp] = await db
        .select()
        .from(passwordResetOtps)
        .where(eq(passwordResetOtps.email, normalizedEmail))
        .orderBy(desc(passwordResetOtps.createdAt))
        .limit(1);

      if (existingOtp) {
        const timeSinceLastRequest =
          now.getTime() - new Date(existingOtp.lastRequestedAt).getTime();
        if (timeSinceLastRequest < OTP_RESEND_COOLDOWN_MS) {
          const remainingSeconds = Math.ceil(
            (OTP_RESEND_COOLDOWN_MS - timeSinceLastRequest) / 1000,
          );
          res.status(429).json({
            error: `Please wait ${remainingSeconds} second(s) before requesting another code.`,
            retryAfterSeconds: remainingSeconds,
          });
          return;
        }
      }

      // Invalidate all previous OTPs for that email
      await db
        .delete(passwordResetOtps)
        .where(eq(passwordResetOtps.email, normalizedEmail));

      // Generate new 6-digit numeric OTP
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpHash = await hashPassword(otpCode);
      const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MS);

      await db.insert(passwordResetOtps).values({
        email: normalizedEmail,
        otpHash,
        attempts: 0,
        verified: false,
        expiresAt,
        lastRequestedAt: now,
      });

      const { sent: emailSent } = await sendOtpEmail(normalizedEmail, otpCode);

      console.log(`\n========================================`);
      console.log(
        `[RESEND OTP ${emailSent ? "SENT VIA RESEND" : "TEST/DEV MODE"}] Target: ${normalizedEmail}`,
      );
      console.log(`[RESEND OTP CODE]: ${otpCode} (Expires in 10 minutes)`);
      console.log(`========================================\n`);

      res.json({
        success: true,
        emailSent,
        testMode: !emailSent,
        testOtpCode: !emailSent ? otpCode : undefined,
        message: emailSent
          ? "A new 6-digit verification code has been sent to your email address."
          : "A new 6-digit verification code has been generated.",
      });
    } catch (error) {
      console.error("Error resending OTP:", error);
      res.status(500).json({ error: "Failed to resend verification code" });
    }
  },
);

/**
 * 8. Forgot Password - Step 2: Verify OTP
 */
router.post(
  "/forgot-password/verify-otp",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawEmail = req.body.email || req.body.phoneNumber || "";
      const otp = req.body.otp;

      if (!rawEmail || !otp) {
        res
          .status(400)
          .json({ error: "Email address and verification code are required" });
        return;
      }

      const normalizedEmail = normalizeEmail(rawEmail);
      const now = new Date();

      const [record] = await db
        .select()
        .from(passwordResetOtps)
        .where(
          and(
            eq(passwordResetOtps.email, normalizedEmail),
            gt(passwordResetOtps.expiresAt, now),
          ),
        )
        .orderBy(desc(passwordResetOtps.createdAt))
        .limit(1);

      if (!record) {
        res
          .status(400)
          .json({
            error:
              "Verification code has expired or is invalid. Please request a new code.",
          });
        return;
      }

      if (record.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        await db
          .delete(passwordResetOtps)
          .where(eq(passwordResetOtps.id, record.id));
        res
          .status(429)
          .json({
            error:
              "Too many incorrect attempts. Please request a new verification code.",
          });
        return;
      }

      const isValidOtp = await bcrypt.compare(otp.trim(), record.otpHash);

      if (!isValidOtp) {
        const remainingAttempts =
          MAX_OTP_VERIFY_ATTEMPTS - (record.attempts + 1);
        await db
          .update(passwordResetOtps)
          .set({ attempts: record.attempts + 1 })
          .where(eq(passwordResetOtps.id, record.id));

        res.status(400).json({
          error: `Incorrect code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
          remainingAttempts,
        });
        return;
      }

      // Mark as verified and generate a secure single-use reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      await db
        .update(passwordResetOtps)
        .set({ verified: true, otpHash: await hashPassword(resetToken) })
        .where(eq(passwordResetOtps.id, record.id));

      res.json({
        success: true,
        resetToken,
        message: "Email address verified successfully.",
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  },
);

/**
 * 9. Forgot Password - Step 3: Set New Password
 */
router.post(
  "/forgot-password/reset-password",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rawEmail = req.body.email || req.body.phoneNumber || "";
      const resetToken = req.body.resetToken || req.body.otp;
      const newPassword = req.body.newPassword;

      if (!rawEmail || !resetToken || !newPassword) {
        res
          .status(400)
          .json({
            error:
              "Email address, verification token, and new password are required",
          });
        return;
      }

      if (newPassword.length < 6) {
        res
          .status(400)
          .json({ error: "New password must be at least 6 characters long" });
        return;
      }

      const normalizedEmail = normalizeEmail(rawEmail);
      const now = new Date();

      // Look for active verified OTP record
      const [record] = await db
        .select()
        .from(passwordResetOtps)
        .where(
          and(
            eq(passwordResetOtps.email, normalizedEmail),
            gt(passwordResetOtps.expiresAt, now),
          ),
        )
        .orderBy(desc(passwordResetOtps.createdAt))
        .limit(1);

      if (!record) {
        res
          .status(400)
          .json({
            error:
              "Reset session has expired or is invalid. Please request a new code.",
          });
        return;
      }

      // Compare token
      const tokenValid = await bcrypt.compare(resetToken, record.otpHash);
      if (!tokenValid && !record.verified) {
        res.status(403).json({ error: "Invalid or unverified reset token" });
        return;
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password in users or admins
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      if (u) {
        await db
          .update(users)
          .set({ passwordHash: newPasswordHash })
          .where(eq(users.id, u.id));
        // Invalidate all active sessions for this user
        await db.delete(sessions).where(eq(sessions.userId, u.id));
      } else {
        const [a] = await db
          .select({ id: admins.id })
          .from(admins)
          .where(eq(admins.email, normalizedEmail))
          .limit(1);
        if (a) {
          await db
            .update(admins)
            .set({ passwordHash: newPasswordHash })
            .where(eq(admins.id, a.id));
          // Invalidate all active sessions for this admin
          await db.delete(sessions).where(eq(sessions.adminId, a.id));
        }
      }

      // Clear failed login attempts and delete OTP record
      await db
        .delete(failedLoginAttempts)
        .where(eq(failedLoginAttempts.email, normalizedEmail));
      await db
        .delete(passwordResetOtps)
        .where(eq(passwordResetOtps.id, record.id));

      res.json({
        success: true,
        message:
          "Your password has been reset successfully. You may now log in with your new password.",
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  },
);

export default router;
