import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { projectsRouter } from './routes/projects.js';
import { progressRouter } from './routes/progress.js';
import { complaintsRouter } from './routes/complaints.js';
import { aiRouter } from './routes/ai.js';

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'NIRIKSHAK Backend API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'Supabase PostgreSQL',
  });
});

app.use('/api/projects', projectsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/ai', aiRouter);

const PORT = Number(process.env.PORT) || 4000;
// When deployed as a serverless function on Vercel, the export `app` is used directly.
// In standalone environments (development, local node/tsx, container), start the HTTP server.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`NIRIKSHAK Backend API listening on port ${PORT}`);
  });
}
