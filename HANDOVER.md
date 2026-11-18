# NIRIKSHAK — Handover document

Prepared for the operating government department. Read this together with [docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) (how to run it) and [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) (who can do what).

## 1. What the system is

A public-infrastructure transparency and delivery platform with three portals in one web application. All three use a single PostgreSQL database (Supabase) that enforces every access rule:

- **Government portal:** project registry and oversight; tenders with sealed bids, an evaluation committee, two-key bid opening, committee scoring (QCBS) and award; progress verification; budget and finance; contractors; complaints; AI risk insights (advisory); reports; access approvals; audit log.
- **Contractor portal:** tender discovery and bidding; assigned projects; progress reports with uploaded photo and document evidence; workers, resources and invoices; correspondence with the department.
- **Citizen portal:** verified public project information, nearby projects, complaint filing with photo evidence and tracking, AI photo scan, and an assistant that answers only from the public project registry.

## 2. Architecture

```
Browser (React SPA, Cloudflare Pages)
   │  publishable key + user JWT          │  user JWT
   ▼                                      ▼
Supabase (Postgres + RLS, Auth, Storage) ◄── Backend API (Express, Vercel)
                                              │  zero-data-retention requests
                                              ▼
                                         OpenRouter (AI, advisory only)
```

- **Single source of truth:** the database. Cross-portal flows are database state changes protected by RLS. Critical transitions run in database functions: submit/approve progress, set committee, open bids, evaluate, award, approve access, complaint status.
- **The backend** handles registration, AI, and inputs that need server-side validation, such as complaints and progress evidence. It calls workflow functions with the caller's own token, so the database rules apply to it as well.
- **Schema of record:** `backend/supabase/migrations/001`–`045`. Since this handover, the schema can be rebuilt from the migrations alone, and CI does exactly that on every change.

## 3. State at handover

| Area | Status |
| :--- | :--- |
| Build | Frontend (3 portals) and backend typecheck and build with no errors |
| Dependencies | `npm audit`: 0 vulnerabilities (frontend and backend) |
| Backend tests | 38 unit/HTTP tests pass |
| Database security tests | 78 checks pass on a database rebuilt from migrations 001–045 |
| CI | Runs all of the above, plus a dependency audit and a secret scan, on every push and pull request |

### Changes made in the production-readiness pass

- **Two-step verification** is required for every government and contractor account and enforced in the database. The former 2FA/OTP screens accepted any code and have been removed.
- **Sealed bids:** officers cannot see bids until two committee members open them after the due date. Each committee member scores separately, and an award needs the required number of evaluations. Bid amounts no longer appear in the audit log.
- **Tenancy:** every project and tender now has an owner. Projects without one were previously writable by every government organisation. A read-only oversight role covers cross-organisation monitoring.
- **Closed data exposures** found when replaying the migrations:
  - Every user's name and phone were readable without logging in.
  - Two import tables had RLS switched off.
  - Anyone could forge audit-log rows and complaint-status history.
  - Internal complaint notes were readable through public tracking.
- **Evidence is now real:** contractor progress photos and documents and citizen complaint photos are uploaded to private storage. Previously only the file names were saved.
- **Registration:** email confirmation, official email domains for government applicants, no self-approval, and stronger passwords for official accounts.
- **AI:** zero-data-retention routing, no free (prompt-logging) model endpoints by default, timeouts, and no internal errors shown to users.
- **Operations:**
  - Rate limits can be shared across server instances through Redis, and they key on the real client IP.
  - Optional Cloudflare Turnstile bot protection on public forms.
  - Hard-coded test passwords removed from code and documentation.
  - Landing-page media reduced from 209 MB to 12 MB.

## 4. What the department must do before go-live

These steps need the department's own accounts; they cannot be done from the code. The runbook gives each one in detail.

1. Run `audit_live_policies.sql` on the live database, back it up, and apply migrations **040–045**.
2. Turn on *Confirm email* in Supabase Auth; check that TOTP MFA is enabled.
3. Deploy the new frontend and backend straight after migration 043, which enforces MFA.
4. **Delete the seeded test accounts** (`scripts/ops/remove-test-accounts.ts`). Their passwords were published in the repository history.
5. **Rotate** the Supabase service-role key, the OpenRouter key and the hosting tokens, then transfer every cloud account to department ownership.
6. Create the first department administrator, mark the monitoring organisation as oversight, and move projects held by *Nirikshak Platform Administration* to their real authorities.
7. Create Upstash Redis and Cloudflare Turnstile and set their keys (strongly recommended).
8. Move to paid hosting with data in India (Supabase `ap-south-1` or a MeitY-empanelled provider), choose AI models with zero-data-retention endpoints, and publish a DPDP Act privacy notice.
9. Commission a CERT-In-empanelled security audit (VAPT) of the deployed system.

## 5. Data reality

The project registry is real imported data: 3,921 projects, with sanctioned cost for 3,885. The import carried little operational history: planned dates exist for 2 projects, physical progress for 33, and milestones for about 3%. For most projects the AI therefore reports that schedule and finance evidence is missing. That is the correct answer for those records, not a malfunction. Insights become useful as departments and contractors record dates, milestones, progress, finance and inspections through the portals. Plan a data-entry drive before public launch.

## 6. Known limitations

- Officers can see that evidence was uploaded and how much, but there is no in-portal viewer for evidence images yet. Files are readable through Supabase Storage by authorised users.
- Contractor document registers and bid documents still record metadata only. Progress evidence and complaint evidence are stored as real files.
- Resetting a lost authenticator is an API call (runbook §3); there is no button in the portal yet.
- The citizen assistant answers from a bounded sample of matching registry rows and labels each answer with its source.
- End-to-end browser tests (`tests/e2e`) need a staging project and are not part of CI.
