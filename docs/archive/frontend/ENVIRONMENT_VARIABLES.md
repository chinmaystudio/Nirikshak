# NIRIKSHAK Environment Variables Configuration

## 1. Frontend Client (`frontend/.env`)
All frontend variables are prefixed with `VITE_` and bundled into the client build:
```env
# Supabase Connectivity
VITE_SUPABASE_URL=https://dmkhkgqyzevhxpxsrgng.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<redacted — set from your Supabase project>

# Feature Toggles
VITE_USE_MOCK_API=false

# Connected Backend API
# The code reads VITE_API_BASE_URL (there is no VITE_BACKEND_URL variable in the code).
VITE_API_BASE_URL=https://backend-one-omega-16.vercel.app
```

---

## 2. Backend Service (`backend/.env`)
Server-side secrets managed in Vercel environment settings:
```env
# Supabase Database & Auth Access
SUPABASE_URL=https://dmkhkgqyzevhxpxsrgng.supabase.co
SUPABASE_ANON_KEY=<redacted — set from your Supabase project>
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
