# Interface refactor

## Canonical routes

- Citizen: `/user`, `/user/projects`, `/user/projects/:id`, `/user/complaints`, `/user/alerts` and related `/user/*` screens.
- Government: `/government/dashboard`, `/government/projects`, and `/government/projects/:id/*`.
- Contractor: `/contractor/dashboard`, `/contractor/tenders/*`, `/contractor/projects`, and `/contractor/projects/:id/*`.

The application uses a single root `BrowserRouter`. Contractor and Citizen navigation now writes clean pathname URLs. Direct refresh therefore depends on the existing Vercel catch-all rewrite in `frontend/vercel.json`.

## Deprecated routes

Legacy hash URLs such as `/contractor/#/projects` and `/#/projects` are normalized on startup to `/contractor/projects` and `/user/projects`. The Government module's former `/citizen/*` screens redirect to equivalent `/user/*` routes; `src/modules/user` is the only canonical Citizen portal.

## Data and demo behavior

Production data comes from Supabase. Contractor projects use `contractor_assigned_projects_view`, which preserves the existing database/RLS access rules. Missing fields render as empty or `Not available`; production no longer fills them with plausible people, dates, progress, finance, inspections, or alerts.

Static fixtures and demonstration-only queues are enabled only when `VITE_DEMO_MODE=true` or `VITE_USE_MOCK_API=true`. Public fictional alerts and the ticker are hidden when demo mode is off.

## Realtime status

Portal headers show a small Supabase channel state: `Live`, `Reconnecting`, or `Offline`. This reports connection state only; it does not claim that an individual record has been officially verified. AI observations are described as AI-assisted and remain advisory.

## CI/CD

- `CI`: runs on pushes to `main` and pull requests. It installs locked dependencies with Node 22, typechecks and builds the frontend and backend, caches npm data, and uploads both build outputs.
- `Deploy to Vercel`: manual production workflow. It requires repository/environment secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_FRONTEND_PROJECT_ID`, and `VERCEL_BACKEND_PROJECT_ID`.
- Dependabot checks frontend npm, backend npm, and GitHub Actions dependencies weekly.
