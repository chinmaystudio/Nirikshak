# NIRIKSHAK Environment Variables Configuration

## 1. Frontend Client (`frontend/.env`)
All frontend variables are prefixed with `VITE_` and bundled into the client build:
```env
# Supabase Connectivity
VITE_SUPABASE_URL=https://dmkhkgqyzevhxpxsrgng.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRta2hrZ3F5emV2aHhweHNyZ25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTIwNDEsImV4cCI6MjA5MDEyODA0MX0.vDbg0xJ5N5Fm0yEIdjD3c3vj2R86kE715aV3Vd0eRvg

# Feature Toggles
VITE_USE_MOCK_API=false

# Connected Backend API
VITE_BACKEND_URL=https://nirikshak-backend-api.vercel.app
```

---

## 2. Backend Service (`backend/.env`)
Server-side secrets managed in Vercel environment settings:
```env
# Supabase Database & Auth Access
SUPABASE_URL=https://dmkhkgqyzevhxpxsrgng.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRta2hrZ3F5emV2aHhweHNyZ25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTIwNDEsImV4cCI6MjA5MDEyODA0MX0.vDbg0xJ5N5Fm0yEIdjD3c3vj2R86kE715aV3Vd0eRvg
SUPABASE_SERVICE_ROLE_KEY=

# AI Provider Configuration
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=nvidia/nemotron-4-340b-instruct

# Local LLM Fallback (Air-gapped deployment)
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=nemotron

# Server Environment
PORT=4000
NODE_ENV=production
```
*Note: Service role keys and AI API keys are never bundled into the client build.*
