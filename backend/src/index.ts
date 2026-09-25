import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { projectsRouter } from './routes/projects.js';
import { progressRouter } from './routes/progress.js';
import { complaintsRouter } from './routes/complaints.js';
import { aiRouter } from './routes/ai.js';

dotenv.config();

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

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`NIRIKSHAK Backend API listening on port ${PORT}`);
  });
}
