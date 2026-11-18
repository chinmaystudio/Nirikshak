# NIRIKSHAK PLATFORM — SECURE DEPLOYMENT SPECIFICATION

**Document Version:** 1.0.0  
**Status:** READY FOR PRODUCTION DEPLOYMENT  
**Targets:**  
- **Frontend:** Vercel (Edge / Static CDN)  
- **Backend:** Render (Web Service)  
- **Database/Auth/Storage/Realtime:** Supabase  
- **AI Engine:** OpenRouter / NVIDIA Nemotron  

---

## 1. Environment Variable Architecture

### 1.1 Frontend (Vercel)
Only non-sensitive public variables prefixed with `VITE_` are permitted in the frontend environment. **Never** supply database passwords, service role keys, or OpenRouter keys to Vercel.

| Variable Name | Purpose | Example Value | Sensitivity |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase API Gateway URL | `https://dmkhkgqyzevhxpxsrgng.supabase.co` | Non-sensitive (Public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Public Key | `eyJhbGciOi...` | Non-sensitive (Public) |
| `VITE_API_BASE_URL` | Render Backend REST Base URL | `https://nirikshak-backend.onrender.com` | Non-sensitive (Public) |
| `VITE_USE_MOCK_API` | Disable mock data in production | `false` | Non-sensitive |
| `VITE_DEMO_MODE` | Disable demo account switching | `false` | Non-sensitive |
| `VITE_SHOW_DEMO_CREDENTIALS` | Hide demo credentials on login | `false` | Non-sensitive |

### 1.2 Backend (Render)
All sensitive secrets, database connection keys, and API tokens must reside exclusively on Render.

| Variable Name | Purpose | Example Value | Sensitivity |
| :--- | :--- | :--- | :--- |
| `PORT` | Listening Port | `4000` | Non-sensitive |
| `NODE_ENV` | Runtime Environment | `production` | High |
| `SUPABASE_URL` | Supabase API Gateway URL | `https://dmkhkgqyzevhxpxsrgng.supabase.co` | Non-sensitive |
| `SUPABASE_ANON_KEY` | Supabase Public Anon Key | `eyJhbGciOi...` | Non-sensitive |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhbGciOi...` | **RESTRICTED / SECRET** |
| `OPENROUTER_API_KEY` | OpenRouter Model Gateway Key | `sk-or-v1-...` | **RESTRICTED / SECRET** |
| `ALLOWED_ORIGINS` | Permitted CORS Origins (comma-separated) | `https://nirikshak.vercel.app,http://localhost:5173` | High |

---

## 2. Vercel Frontend Configuration (`frontend/vercel.json`)

The frontend routing and security headers are codified in `frontend/vercel.json`:
- **Security Headers Injected at CDN Edge:**
  - `Content-Security-Policy`: Restricts script and connection sources to authorized domains (`self`, Supabase, OpenRouter, Render).
  - `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload` (enforces HTTPS).
  - `X-Content-Type-Options`: `nosniff`.
  - `X-Frame-Options`: `DENY` (prevents clickjacking).
  - `Referrer-Policy`: `strict-origin-when-cross-origin`.
  - `Permissions-Policy`: `camera=(), microphone=(), geolocation=(self)`.
- **SPA Rewrites:** All clean URLs rewrite to `/index.html` for client-side routing.

---

## 3. Render Backend Configuration

1. **Build Command:**
   ```bash
   npm ci && npm run build
   ```
2. **Start Command:**
   ```bash
   node dist/index.js
   ```
3. **Health Check Path:**
   `/health` (returns `{"status":"ok"}` with HTTP 200).
4. **Security Defenses Active:**
   - Strict CORS validation against `ALLOWED_ORIGINS`.
   - Token-bucket rate limiting on auth, complaints, and AI endpoints.
   - Global safe error handler redacting database schema information and stack traces.

---

## 4. Post-Deployment Verification Checklist

Upon deploying to Vercel and Render, verify:
- [x] **HTTPS:** Site serves strictly over HTTPS with valid SSL/TLS certificate.
- [x] **Bundle Secret Scan:** Download compiled JS bundles from Vercel CDN and verify no service keys or OpenRouter keys are present.
- [x] **Health Check:** `curl -s https://<backend>/health` returns strictly `{"status":"ok"}`.
- [x] **CORS:** Unauthorized cross-origin requests receive HTTP 403 or are blocked by the browser.
- [x] **Privileged Signups:** Attempting to inject `role: 'government_admin'` via signup produces only a standard citizen profile.
- [x] **Tenant Separation:** Ensure Contractor A cannot inspect Contractor B's project dashboard or bid submissions.

---
*End of Secure Deployment Specification.*
