# NIRIKSHAK (निरीक्षक) — Infrastructure Monitoring & Public Accountability Platform

NIRIKSHAK connects **government authorities**, **infrastructure contractors** and **citizens** in one audited project lifecycle: project registry → tender → sealed bids → committee evaluation → award → contractor progress claims with evidence → government verification → public view → citizen grievances. The database (Supabase PostgreSQL with Row Level Security) is the single source of truth and enforces every access rule.

| Portal | Route | Users | Main capabilities |
| :--- | :--- | :--- | :--- |
| Government | `/government` | Authority officers, chief engineers, auditors | Project register, tenders, evaluation committee, sealed-bid opening, award, progress verification, grievances, finance, audit log, access approvals |
| Contractor | `/contractor` | Contractor organisations | Tender discovery and bids, assigned projects, progress reporting with uploaded evidence, workers/resources/invoices, correspondence |
| Citizen | `/` and `/user` | Public | Verified project information, nearby projects, complaint filing and tracking, AI photo scan and assistant |

Government and contractor accounts must use **two-step verification** (authenticator app). The AI features are **advisory only**: they never approve, award or certify anything.

## Repository layout

```
frontend/                 React 18 + Vite 7 single-page app (all three portals)
backend/                  Express API (Node 22): registration, workflows, AI
backend/supabase/migrations/   numbered SQL migrations — the schema of record
backend/supabase/test/    migration replay + database security test suite
backend/tests/            backend unit and HTTP tests
docs/                     operations runbook, security model, archived reports
HANDOVER.md               handover document for the operating department
```

## Quick start (local development)

Prerequisites: Node.js 22, npm 10, a **non-production** Supabase project, PostgreSQL client tools (`psql`) for the database tests.

```bash
git clone https://github.com/chinmaystudio/Nirikshak.git && cd Nirikshak

cd backend  && npm ci && cp .env.example .env    # fill in the values
cd ../frontend && npm ci && cp .env.example .env # fill in the values
```

Apply the migrations to your development project (Supabase SQL editor, in file-name order, or `supabase db push`). Then:

```bash
cd backend  && npm run dev     # API on http://localhost:4000
cd frontend && npm run dev     # app on http://localhost:5173
```

For local development without an authenticator app you may set `VITE_REQUIRE_MFA=false` (frontend), `REQUIRE_MFA=false` (backend) and `UPDATE public.platform_settings SET value='false' WHERE key='require_mfa'` on the **development** database only.

## Tests

| Command | What it checks |
| :--- | :--- |
| `cd frontend && npm run typecheck && npm run build` | All three portals compile and bundle |
| `cd backend && npm test` | 38 unit/HTTP tests: MFA gate, AI privacy routing, storage paths, rate limits, auth surface, validation |
| `cd backend && ADMIN_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npm run test:db` | Rebuilds the schema from every migration on an empty PostgreSQL and runs 78 security checks as anonymous, citizen, contractor, two government organisations and oversight users |

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request, plus `npm audit` and a secret scan.

## Deployment and operations

See **[HANDOVER.md](HANDOVER.md)** and **[docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md)**. The security design is described in **[docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md)**.

There are no shared or demo credentials in this repository. Accounts are created through registration and approved by an administrator.

Reports written during development are kept for reference in `docs/archive/`; they describe earlier states of the system and are **not** authoritative.
