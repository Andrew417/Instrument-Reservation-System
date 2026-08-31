import crypto from 'crypto';
import { db } from '../db/index.ts';
import { sessions, users, admins } from '../db/schema.ts';
import { eq, and, gt, sql } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/index.ts';

// Inactivity timeout: 30 minutes of no user activity
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// Absolute session max age: 7 days
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  phoneNumber: string;
  role: 'user' | 'admin' | 'super_admin';
  isTrusted?: boolean;
  isActive?: boolean;
  approvalStatus?: string;
  isSuperAdmin?: boolean;
  createdAt: string;
}

export interface ActiveSession {
  sessionId: string;
  token: string;
  userId: string | null;
  adminId: string | null;
  role: 'user' | 'admin' | 'super_admin';
  lastActiveAt: Date;
  expiresAt: Date;
  user: SessionUser;
}

/**
 * Generate a cryptographically secure 256-bit session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new persistent session in PostgreSQL
 */
export async function createSession(
  accountId: string,
  role: 'user' | 'admin' | 'super_admin'
): Promise<{ token: string; session: ActiveSession }> {
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);

  const isUser = role === 'user';
  const isAdm = role === 'admin' || role === 'super_admin';

  const [inserted] = await db
    .insert(sessions)
    .values({
      token,
      userId: isUser ? accountId : null,
      adminId: isAdm ? accountId : null,
      role,
      lastActiveAt: now,
      expiresAt,
    })
    .returning();

  // Fetch user details
  let userDetails: SessionUser;
  if (isUser) {
    const [u] = await db.select().from(users).where(eq(users.id, accountId)).limit(1);
    if (!u || !u.isActive || u.approvalStatus !== 'approved') {
      throw new Error('Cannot create session for inactive or unapproved account');
    }
    userDetails = {
      id: u.id,
      name: u.name,
      phoneNumber: u.phoneNumber,
      role: 'user',
      isTrusted: u.isTrusted,
      isActive: u.isActive,
      approvalStatus: u.approvalStatus,
      createdAt: u.createdAt.toISOString(),
    };
  } else {
    const [a] = await db.select().from(admins).where(eq(admins.id, accountId)).limit(1);
    userDetails = {
      id: a.id,
      name: a.name,
      phoneNumber: a.phoneNumber,
      role: a.isSuperAdmin ? 'super_admin' : 'admin',
      isSuperAdmin: a.isSuperAdmin,
      approvalStatus: a.approvalStatus || 'approved',
      createdAt: a.createdAt.toISOString(),
    };
  }

  const activeSession: ActiveSession = {
    sessionId: inserted.id,
    token: inserted.token,
    userId: inserted.userId,
    adminId: inserted.adminId,
    role: inserted.role as any,
    lastActiveAt: inserted.lastActiveAt,
    expiresAt: inserted.expiresAt,
    user: userDetails,
  };

  return { token, session: activeSession };
}

/**
 * Validate session token with strict inactivity timeout check
 */
export async function validateSession(token: string): Promise<{ valid: boolean; session?: ActiveSession; error?: string }> {
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }

  const now = new Date();
  const sessionRecords = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);

  if (sessionRecords.length === 0) {
    return { valid: false, error: 'Invalid session token' };
  }

  const s = sessionRecords[0];

  // 1. Check absolute expiration
  if (s.expiresAt < now) {
    await db.delete(sessions).where(eq(sessions.id, s.id));
    return { valid: false, error: 'Session has expired' };
  }

  // 2. Check inactivity window (30 minutes)
  const timeSinceLastActivity = now.getTime() - new Date(s.lastActiveAt).getTime();
  if (timeSinceLastActivity > INACTIVITY_TIMEOUT_MS) {
    await db.delete(sessions).where(eq(sessions.id, s.id));
    return { valid: false, error: 'Session expired due to inactivity' };
  }

  // 3. Update lastActiveAt to sliding window
  await db
    .update(sessions)
    .set({ lastActiveAt: now })
    .where(eq(sessions.id, s.id));

  // 4. Fetch profile
  let userDetails: SessionUser | null = null;
  if (s.role === 'user' && s.userId) {
    const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
    if (u) {
      if (!u.isActive || u.approvalStatus !== 'approved') {
        await db.delete(sessions).where(eq(sessions.id, s.id));
        return {
          valid: false,
          error: u.approvalStatus === 'rejected'
            ? 'Your account registration was not approved.'
            : 'Your account is awaiting admin approval or has been deactivated.',
        };
      }
      userDetails = {
        id: u.id,
        name: u.name,
        phoneNumber: u.phoneNumber,
        role: 'user',
        isTrusted: u.isTrusted,
        isActive: u.isActive,
        approvalStatus: u.approvalStatus,
        createdAt: u.createdAt.toISOString(),
      };
    }
  } else if ((s.role === 'admin' || s.role === 'super_admin') && s.adminId) {
    const [a] = await db.select().from(admins).where(eq(admins.id, s.adminId)).limit(1);
    if (a) {
      userDetails = {
        id: a.id,
        name: a.name,
        phoneNumber: a.phoneNumber,
        role: a.isSuperAdmin ? 'super_admin' : 'admin',
        isSuperAdmin: a.isSuperAdmin,
        approvalStatus: a.approvalStatus || 'approved',
        createdAt: a.createdAt.toISOString(),
      };
    }
  }

  if (!userDetails) {
    await db.delete(sessions).where(eq(sessions.id, s.id));
    return { valid: false, error: 'Account associated with session not found' };
  }

  return {
    valid: true,
    session: {
      sessionId: s.id,
      token: s.token,
      userId: s.userId,
      adminId: s.adminId,
      role: s.role as any,
      lastActiveAt: now,
      expiresAt: s.expiresAt,
      user: userDetails,
    },
  };
}

/**
 * Destroy session (Logout)
 */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.token, token));
}

/**
 * Express Middleware to enforce authentication
 */
export async function requireAuth(req: Request & { user?: SessionUser; session?: ActiveSession }, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const { valid, session, error } = await validateSession(token);
  if (!valid || !session) {
    res.status(401).json({ error: error || 'Invalid or expired session', isExpired: true });
    return;
  }

  req.user = session.user;
  req.session = session;
  next();
}

/**
 * Execute a PostgreSQL query within the logged-in user's RLS session context
 */
export async function withUserContext<T>(
  user: { id: string; role: 'user' | 'admin' | 'super_admin' },
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [user.id]);
    await client.query(`SELECT set_config('app.current_role', $2, true)`, [user.role]);
    await client.query(`SELECT set_config('app.is_admin', $3, true)`, [isAdmin ? 'true' : 'false']);

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
