# NIRIKSHAK API & Backend Functions Documentation

## 1. Overview
NIRIKSHAK exposes dual API surfaces:
1. **Direct Typed Supabase Data API**: High-performance typed queries protected by Row Level Security.
2. **Backend Express API & Edge Functions**: Privileged transactional mutations, multi-step validations, and AI risk analysis.

---

## 2. API Endpoints Reference

### 2.1 Projects
- **`GET /api/projects`**
  - Query parameters: `city`, `sector`, `status`, `limit`, `offset`
  - Response: `{ success: true, data: { projects: [...], total: 3896, limit: 50, offset: 0 } }`
- **`GET /api/projects/:id`**
  - Parameters: `:id` (UUID or `nirikshak_project_id` e.g., `NIR-PUNE-METRO-001`)
  - Includes: `project_milestones`, `contracts`, `complaints`
- **`POST /api/projects`**
  - Payload validated via `CreateProjectSchema` (Zod)
  - Privileged to Government users

### 2.2 Progress Reporting & Verification
- **`POST /api/progress/submit`**
  - Contractor submission endpoint
  - Validates `reported_progress` (0-100%), milestone link, and evidence paths
  - Sets `verification_status: 'SUBMITTED'`
- **`POST /api/progress/review`**
  - Government verification endpoint
  - Atomic transaction calling `approve_progress_update` RPC
  - Updates milestone verified progress, recalculates overall project percentage, logs audit record, and triggers contractor notification

### 2.3 Complaints & Citizen Grievances
- **`POST /api/complaints`**
  - Validates category, title, description, geo-coordinates, and photos
  - Generates immutable reference number (e.g., `NIR-CMP-2026-789012`)
  - Immediately retrievable
- **`GET /api/complaints/track/:ref`**
  - Public tracking endpoint
  - Returns current status, resolution timeline (`complaint_updates`), and public evidence

### 2.4 AI Risk Intelligence
- **`POST /api/ai/analyze/:projectId`**
  - Assembles sanitized project context (schedule, budget, milestones, grievances)
  - Routes to configured provider (`OpenRouterProvider` with Nemotron-4-340B or `LocalLLMProvider`)
  - Enforces strictly validated JSON schema response
  - Persists risk score, schedule/finance/environmental risks, and recommendations into `ai_insights`
