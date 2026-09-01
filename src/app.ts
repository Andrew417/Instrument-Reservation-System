import express from "express";
import authRouter from "./server/auth";
import reservationsRouter from "./server/reservations";
import instrumentsRouter from "./server/instruments";
import notificationsRouter from "./server/notifications";
import adminRouter from "./server/admin";

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

  return app;
}
