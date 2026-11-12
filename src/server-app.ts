import express from "express";
import authRouter from "./server/auth.js";
import reservationsRouter from "./server/reservations.js";
import instrumentsRouter from "./server/instruments.js";
import notificationsRouter from "./server/notifications.js";
import adminRouter from "./server/admin.js";
import pushRouter from "./server/push.js";
import { sendSafeErrorResponse } from "./server/error-response.js";

export function createExpressApp() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/reservations", reservationsRouter);
  app.use("/api/instruments", instrumentsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/push", pushRouter);

  // 404 handler for any unhandled /api/* requests so they never fall through to HTML/Vite SPA handler
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global error handler for /api/* requests
  app.use(
    "/api/*",
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      sendSafeErrorResponse(res, "[API Error]", err);
    },
  );

  return app;
}
