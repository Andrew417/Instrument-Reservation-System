import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import authRouter from './src/server/auth.ts';
import reservationsRouter from './src/server/reservations.ts';
import instrumentsRouter from './src/server/instruments.ts';
import notificationsRouter from './src/server/notifications.ts';
import adminRouter from './src/server/admin.ts';
import { seedSuperAdmin } from './src/db/seed-super-admin.ts';
import { runStatusTransitions } from './src/services/reservation-logic.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Run Super Admin DB-level idempotent seed on startup
  try {
    await seedSuperAdmin();
  } catch (err: any) {
    console.error('[Startup Seed Warning]:', err.message || err);
  }

  // Middleware
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/instruments', instrumentsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/admin', adminRouter);

  // Background status transitions: run every 60 seconds
  setInterval(async () => {
    try {
      await runStatusTransitions();
    } catch (e) {
      console.error('Error in status transitions job:', e);
    }
  }, 60 * 1000);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
