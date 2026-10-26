import "./src/env-loader";
import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createExpressApp } from "./src/server-app";
import { seedSuperAdmin } from "./src/db/seed-super-admin";
import { ensureEnhancedColumns, ensurePushTables } from "./src/db/index";
import { runStatusTransitions } from "./src/services/reservation-logic";

export async function createServer() {
  const app = createExpressApp();
  const PORT = 3000;

  // Run Super Admin DB-level idempotent seed & verify enhanced table columns lazily in background
  seedSuperAdmin().catch((err: any) => {
    console.warn("[Super Admin Seed Notice]:", err.message || err);
  });

  ensureEnhancedColumns().catch((err: any) => {
    console.warn("[DB Columns Check Notice]:", err.message || err);
  });

  ensurePushTables().catch((err: any) => {
    console.warn("[DB Push Tables Check Notice]:", err.message || err);
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
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

// Global safety net to prevent transient background errors from crashing the dev server process
process.on("unhandledRejection", (reason) => {
  console.warn("[Unhandled Rejection Notice (handled)]:", reason);
});
process.on("uncaughtException", (err) => {
  console.warn("[Uncaught Exception Notice (handled)]:", err?.message || err);
});

// Start listener for local development / Cloud Run environments
async function startServer() {
  const { app, PORT } = await createServer();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[Server] Port ${PORT} busy, retrying in 1s...`);
      setTimeout(() => {
        try {
          server.close();
        } catch {}
        server.listen(PORT, "0.0.0.0");
      }, 1000);
    } else {
      console.error("[Server Error]:", err);
    }
  });

  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });

  return server;
}

// In Node/TS execution, start server
if (process.env.VERCEL !== "1") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default createExpressApp;
