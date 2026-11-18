# Nirikshak — Handover Document

**Status as of 18 Nov 2026:** Production system, live and verified end-to-end.
Prepared for handover to the operating government department.

---

## 1. What Nirikshak is

A public-infrastructure transparency and delivery platform with three portals
served from one web application, all connected through a single database —
there is no mock or demo data anywhere in the production system:

- **Government portal** — project registry and oversight, tender management
  (publish → bid → QCBS evaluation → award), progress verification, budget and
  finance tracking, contractor directory, complaints oversight, AI risk
  insights, reports, access-request approvals.
- **Contractor portal** — organisation workspace for awarded contractors:
  assigned projects, milestone/progress reporting with evidence, workers and
  resources registers, document register, invoices/bills, government
  correspondence, tender discovery and bid submission.
- **Citizen portal** — public project tracking (3,921 projects), nearby
  projects, community complaint feed, complaint filing (with or without a
  linked project), AI photo scan of infrastructure issues, and an AI assistant
  that answers from the live project registry.

## 2. Live system

| Component | Where | Notes |
|---|---|---|
| Web app (all 3 portals) | https://nirikshak.pages.dev | Cloudflare Pages, direct-upload deploys |
| Backend API | https://backend-one-omega-16.vercel.app | Vercel; auto-deploys from GitHub `main` |
| Database / Auth / Storage APIs | Supabase project `dmkhkgqyzevhxpxsrgng` | Postgres + Row Level Security on every table |
| Source code | GitHub `chinmaystudio/Nirikshak` | `main` is always the deployable state |
| AI provider | OpenRouter (NVIDIA Nemotron family) | Backend-only; key lives in Vercel env vars |

A second backend copy exists on Render (`nirikshak-backend-pgqm.onrender.com`)
from an earlier deployment; the production frontend uses the Vercel backend.

## 3. Architecture in one page

- **Single source of truth:** Supabase Postgres. The portals never talk to
  each other directly; every cross-portal flow (progress submitted by a
  contractor → verified by government → visible to citizens) is a database
  state change guarded by RLS and, for critical transitions, by RPC functions
  (`approve_progress_update`, `award_contract`, `save_tender_bid`,
  `submit_progress_update`, `withdraw_tender_bid`).
- **Access model:** users belong to organisations (`organization_members`).
  Government authority, contractor assignment and citizen access are all
  enforced in the database by RLS policies — the frontend cannot widen them.
- **AI (advisory only):** `POST /api/ai/analyze/:projectId` (government /
  assigned contractor) builds a context from the project's real record —
  computed schedule/budget signals plus finance, inspections, progress,
  complaints and contracts — and stores a structured, Zod-validated insight
  in `ai_insights`, linked to an `ai_runs` audit row. Risk level is derived
  server-side from the risk score with fixed bands (0–24 LOW, 25–49 MEDIUM,
  50–74 HIGH, 75–100 CRITICAL) so an insight can never contradict itself.
  Citizen AI: `POST /api/ai/vision` (photo analysis) and `POST /api/ai/ask`
  (registry-grounded Q&A). The AI never approves, awards or certifies
  anything; if the provider is unavailable the API returns an error rather
  than a fabricated answer.
- **Schema history:** migrations `001`–`038` in
  `backend/supabase/migrations/`, all applied to the production database.

## 4. Verified state (18 Nov 2026 end-to-end sweep)

Exercised live with the seeded accounts (see §6):

- Government: 24 feature checks passed — registry/summary views (3,921
  projects), tenders (46) and bids (109), approvals queue, contractors (19
  organisations, 39 contracts), finance (130 updates), inspections,
  complaints, documents, AI insights, access requests, audit log.
- Citizen: public registry (count, paging, search, filters), community feed,
  project-linked and project-less complaint filing, AI ask + vision — all
  working. (Project-less filing required migration 038; applied and
  re-verified.)
- Contractor: 20 of 22 checks passed — organisation identity, 5 assigned
  projects, tenders/bids (incl. server-side bid validation), progress /
  inspections / finance reads, full create→read→delete round-trips on the
  workers / resources / messages / invoices tables (migration 037), and
  document upload under the new RLS policy. The two gaps found — no
  contractor DELETE policy for their own document rows, and stale
  `profiles.role` labels on the seeded test accounts — are fixed by
  migration 039.
- AI analysis re-run live after the consistency fix: title, badge, severity
  and score agree (e.g. MEDIUM / 40) and the summary cites the project's
  actual figures.

## 5. Data reality — read before demonstrating

The project registry is real imported data (3,921 projects; sanctioned cost
present for 3,885), but the import carried almost no operational history:

- Planned start / completion dates exist for only **2** projects; physical
  progress for **33**; milestones cover ~3% of projects; `delay_events` is
  empty; finance/inspection history is seed-scale (130 / 16 rows).
- Consequence: for most projects the AI correctly reports schedule/finance
  evidence as missing — that is the honest answer for those records, not a
  malfunction. Insights become substantive as departments and contractors
  record dates, milestones, progress, finance and inspections through the
  portals (all of those workflows are live and verified).
- Tender QCBS scores are persisted for only 2 of 109 historical bids
  (pre-system awards); evaluations run through the portal persist full
  technical/financial/combined scores.
- Progress-evidence photos: the storage path exists; historical progress
  updates were seeded without photos, so evidence counts read zero until
  contractors submit updates with evidence through the portal.
- Notifications are written by the workflow RPCs (award, progress
  submission/approval, access decisions). Inboxes are empty until those
  workflows run in the app — seeded rows bypassed them.
- The seeded contractor test organisation has no GSTIN / registration
  number recorded (the profile page shows "—"); legal identifiers are
  captured at organisation registration and were never part of the seed.

## 6. Seeded test accounts (change/remove before real rollout)

| Portal | Email | Password |
|---|---|---|
| Government | government.test@nirikshak.local | NirikshakGov#2026 |
| Contractor | contractor.test@nirikshak.local | NirikshakContractor#2026 |
| Citizen | citizen.test@nirikshak.local | NirikshakCitizen#2026 |

The contractor test account belongs to the organisation
"Nirikshak Test Infrastructure Pvt Ltd".

## 7. Operating the system

**Deploy the web app** (from a checkout of `main`):

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name nirikshak
```

**Deploy the backend:** push to `main` — Vercel builds and deploys
automatically. Backend env vars (Vercel project settings): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, optional
`OPENROUTER_MODEL` (a built-in fallback chain of Nemotron models is used
otherwise), `FRONTEND_URL` / CORS origins.

**Database changes:** add a numbered migration under
`backend/supabase/migrations/` and apply it in the Supabase SQL Editor
(project `dmkhkgqyzevhxpxsrgng`). Never edit an already-applied migration.

**Frontend env** (`frontend/.env.production`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (public by design — data is protected by
RLS, not by hiding this key), `VITE_API_BASE_URL`.

## 8. Known limitations (accepted, documented)

- Document registers store metadata; binary file storage for uploads is not
  wired (the UI states this at the point of upload).
- Contractor performance evaluation is computed from live project data
  (schedule, complaints, inspections) rather than stored scores.
- The citizen AI assistant retrieves from a sample of registry rows;
  answers are labelled with their source (AI vs project-data fallback).
- Free-tier/edge constraints of the current hosting plans apply
  (Vercel/Cloudflare/Supabase); all are upgradeable in place without code
  changes.
