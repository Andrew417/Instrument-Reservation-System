import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import authRouter from './src/server/auth.ts';
import reservationsRouter from './src/server/reservations.ts';
import instrumentsRouter from './src/server/instruments.ts';
import notificationsRouter from './src/server/notifications.ts';
import adminRouter from './src/server/admin.ts';
import { ensureCurrentReservationStatuses } from './src/services/reservation-logic.ts';

export async function createApp() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.use('/api', async (_req, _res, next) => {
    try {
      await ensureCurrentReservationStatuses();
      next();
    } catch (error) {
      console.error('Reservation status refresh failed:', error);
      next();
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/instruments', instrumentsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/admin', adminRouter);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT = Number(process.env.PORT || 3000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default createApp;
