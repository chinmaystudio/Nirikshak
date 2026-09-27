import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { securityHeaders, rateLimit, safeErrorHandler } from './middleware/security.js';
import { projectsRouter } from './routes/projects.js';
import { progressRouter } from './routes/progress.js';
import { complaintsRouter } from './routes/complaints.js';
import { aiRouter } from './routes/ai.js';

export const app = express();

// 1. HTTP Security Headers & Correlation ID (Rules 38, 73, 98, 100)
app.use(securityHeaders);

// 2. Strict CORS Configuration (Rule 37)
const allowedOrigins = [
  'https://nirikshak-portal.vercel.app',
  'https://nirikshak.gov.in',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:4000',
];
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()));
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server or curl in dev)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not permitted by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  })
);

// 3. Request Body Limits (Rule 39: Limit JSON request size to 2MB)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. Global Rate Limiter (Rule 40: 120 requests per minute)
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// 5. Hardened Health Check (Rule 99: strictly return status: ok without leaking internal env/db info)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
  });
});

// 6. API Route Handlers
app.use('/api/projects', projectsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/ai', aiRouter);

// 7. Centralized Safe Error Handler (Rule 73)
app.use(safeErrorHandler);

const PORT = Number(process.env.PORT) || 4000;
const isTest = process.env.NODE_ENV === 'test' || process.argv.some((a) => a.includes('test'));
if (!process.env.VERCEL && !isTest) {
  app.listen(PORT, () => {
    console.log(`NIRIKSHAK Backend API listening on port ${PORT}`);
  });
}
