import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createExpressApp } from "./src/server-app";
import { seedSuperAdmin } from "./src/db/seed-super-admin";
import { runStatusTransitions } from "./src/services/reservation-logic";

export async function createServer() {
  const app = createExpressApp();
  const PORT = 3000;

  // Run Super Admin DB-level idempotent seed on startup
  try {
    await seedSuperAdmin();
  } catch (err: any) {
    console.error("[Startup Seed Warning]:", err.message || err);
  }

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return { app, PORT };
}

// Start listener for local development / Cloud Run environments
async function startServer() {
  const { app, PORT } = await createServer();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// In Node/TS execution, start server
if (process.env.VERCEL !== "1") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default createExpressApp;
