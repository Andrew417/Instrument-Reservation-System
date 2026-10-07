import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { pushTokens } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { validateSession } from "./session-manager.js";

const router = Router();

/**
 * Middleware: Verify authenticated user or admin session
 */
async function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : (req.headers["x-session-token"] as string);

  if (!token) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  const { valid, session, error } = await validateSession(token);
  if (!valid || !session) {
    res.status(401).json({ success: false, error: error || "Session expired" });
    return;
  }

  (req as any).authSession = session;
  next();
}

/**
 * POST /api/push/tokens
 * Register or update an FCM push registration token.
 * Reassigns the token to current authenticated account if previously registered elsewhere.
 */
router.post("/tokens", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const session = (req as any).authSession;
    const { token, language, platform } = req.body;

    if (!token || typeof token !== "string" || !token.trim()) {
      res.status(400).json({ success: false, error: "Push token is required" });
      return;
    }

    const cleanToken = token.trim();
    const cleanLanguage = language === "en" ? "en" : "ar";
    const cleanPlatform = typeof platform === "string" ? platform.slice(0, 50) : "web";

    const userId = session.role === "user" ? session.userId : null;
    const adminId =
      session.role === "admin" || session.role === "super_admin"
        ? session.adminId
        : null;

    if (!userId && !adminId) {
      res.status(400).json({ success: false, error: "Invalid session identity" });
      return;
    }

    await db
      .insert(pushTokens)
      .values({
        userId,
        adminId,
        token: cleanToken,
        language: cleanLanguage,
        platform: cleanPlatform,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId,
          adminId,
          language: cleanLanguage,
          platform: cleanPlatform,
          lastSeenAt: new Date(),
        },
      });

    res.json({
      success: true,
      message: "Push token registered successfully",
    });
  } catch (err: any) {
    console.error("[FCM Push] Error registering token:", err);
    res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
});

/**
 * DELETE /api/push/tokens
 * Remove the current device token on logout or permission revoke.
 */
router.delete("/tokens", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const session = (req as any).authSession;
    const token = (req.body?.token || req.query?.token) as string;

    if (!token || typeof token !== "string") {
      res.status(400).json({ success: false, error: "Token is required to unregister" });
      return;
    }

    const cleanToken = token.trim();

    // Delete matching token if owned by this session
    const userId = session.role === "user" ? session.userId : null;
    const adminId =
      session.role === "admin" || session.role === "super_admin"
        ? session.adminId
        : null;

    if (userId) {
      await db
        .delete(pushTokens)
        .where(and(eq(pushTokens.token, cleanToken), eq(pushTokens.userId, userId)));
    } else if (adminId) {
      await db
        .delete(pushTokens)
        .where(and(eq(pushTokens.token, cleanToken), eq(pushTokens.adminId, adminId)));
    }

    res.json({
      success: true,
      message: "Push token removed successfully",
    });
  } catch (err: any) {
    console.error("[FCM Push] Error removing token:", err);
    res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
});

export default router;
