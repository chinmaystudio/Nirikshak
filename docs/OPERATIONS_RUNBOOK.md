# NIRIKSHAK — Operations runbook

## 1. Components and where they are configured

| Component | Hosting (current) | Configuration |
| :--- | :--- | :--- |
| Web app (all portals) | Cloudflare Pages project `nirikshak` | GitHub repository *variables* `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`, `VITE_TURNSTILE_SITE_KEY`; secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Backend API | Vercel project (backend) | Vercel environment variables. The full list with explanations is in `backend/.env.example` |
| Database, auth, storage | Supabase | Supabase dashboard; schema only through `backend/supabase/migrations/` |
| AI | OpenRouter | `OPENROUTER_API_KEY` and model lists in the backend environment |
| Rate-limit store | Upstash Redis (to be created) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Bot protection | Cloudflare Turnstile (to be created) | `VITE_TURNSTILE_SITE_KEY` (frontend), `TURNSTILE_SECRET_KEY` (backend) |

The old Render deployment (`nirikshak-backend-pgqm.onrender.com`) is no longer part of the system. Delete that service in the Render dashboard.

## 2. Go-live checklist (one-time, in this order)

The application code works against the database both before and after migrations 040–045. Before them, it keeps the previous behaviour (single-officer evaluation, no sealed bids, MFA not enforced by the API, direct complaint updates). Each protection switches on automatically once its migration is applied. Apply the migrations promptly: until then the security fixes in the database are not active.

1. **Check the live database first.** In the Supabase SQL editor, run `backend/supabase/test/audit_live_policies.sql` and keep the output for the record.
2. **Back up.** Enable Point-in-Time Recovery (paid plan) or take a manual backup (Database → Backups).
3. **Apply migrations `040` to `046`** in file-name order in the SQL editor. Each file is idempotent. (`032_z_schema_drift_baseline.sql` and the guarded statements in `025`–`027` only matter for a fresh database. On production they do nothing, so they don't need applying.)
   - `041` assigns every project with no owner, either to a government organisation whose name equals the project's `project_authority`, or to a new organisation **Nirikshak Platform Administration** (an oversight organisation). The NOTICE output reports the counts.
   - `043` turns on two-step verification for all government and contractor writes immediately. Deploy the new frontend (step 6) right after it.
4. **Run `audit_live_policies.sql` again.** Every section should now be empty, except the test-account list (step 7).
5. **Supabase Auth settings.**
   - Authentication → Providers → Email: turn **Confirm email** on.
   - Authentication → Multi-Factor: make sure **TOTP** is enabled.
   - Authentication → URL configuration: set the Site URL and redirect URLs to the production frontend.
   - Authentication → Rate limits: review the defaults.
6. **Deploy.** Set the new backend variables (section 1) and then run the *Deploy production* workflow (Actions → Deploy production → Run workflow).
7. **Remove test accounts.** Their passwords were published in this repository's history. Accounts that appear in the audit log cannot be deleted (the audit log is append-only), so the script disables those indefinitely instead.
   ```bash
   cd backend
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ops/remove-test-accounts.ts          # review the list
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ops/remove-test-accounts.ts --apply
   ```
8. **Rotate secrets** before transferring ownership: the Supabase service-role key (Settings → API → roll), the OpenRouter key, and the Vercel and Cloudflare tokens. Then update the hosting variables.
9. **Create the first real administrator** (bootstrap, once). Register through `/government/register` with an official email and confirm it. Then, in the SQL editor:
   ```sql
   -- approve the first government_admin directly (later admins are approved in the portal)
   INSERT INTO public.organization_members (organization_id, user_id, role, status)
   SELECT '<department organisation id>', id, 'government_admin', 'active' FROM auth.users WHERE email = '<official email>';
   UPDATE public.government_access_requests SET status = 'APPROVED', reviewed_at = now()
   WHERE user_id = (SELECT id FROM auth.users WHERE email = '<official email>');
   ```
10. **Decide on oversight.** Flag the department's monitoring organisation so its officers can read every project:
    ```sql
    UPDATE public.organizations SET is_oversight = true WHERE id = '<organisation id>';
    ```
    Then transfer projects held by *Nirikshak Platform Administration* to their real authorities, in the portal or with `SELECT public.transfer_project_ownership('<project id>', '<org id>');`.

## 3. Routine operations

**Database changes.** Add a new numbered file in `backend/supabase/migrations/` (never edit an applied one). Open a pull request; CI rebuilds the schema from zero and runs the security suite. After merge, apply the file in the SQL editor.

**Deploying.** Merge to `main`, then run the *Deploy production* workflow. It typechecks, tests and builds before deploying.

**Lost authenticator.** Another administrator of the same organisation, signed in with two-step verification, runs:
```bash
curl -X POST "$API/api/auth/mfa/reset" -H "Authorization: Bearer <their access token>" \
     -H "Content-Type: application/json" -d '{"user_id":"<affected user id>"}'
```
The user enrols a new authenticator at their next sign-in. The reset is written to the audit log.

**Allowed government email domains.**
```sql
UPDATE public.platform_settings SET value = '["gov.in","nic.in","maharashtra.gov.in"]'::jsonb WHERE key = 'government_email_domains';
```
Keep `GOV_EMAIL_DOMAINS` in the backend environment in step.

**Tender defaults.** Each tender has `technical_weight` (default 0.7), `min_evaluators` (default 2) and `min_opening_members` (default 2). The publish API accepts `bid_due_date`, `technical_weight` and `min_evaluators`.

**Audit review.** Government → Audit shows `audit_logs`. The table is append-only; export it periodically for long-term retention (CERT-In directions require logs to be kept for at least 180 days).

## 4. Monitoring and incidents

- Uptime: monitor `GET <API>/health` (returns `{"status":"ok"}`) and the frontend root, every minute, from an external monitor.
- Logs: backend logs go to the hosting provider. Configure a log drain to the department's log store with 180-day retention. Every error response carries a `requestId` that matches the log line.
- Incident reporting: cyber incidents must be reported to CERT-In within 6 hours of detection. Keep the contact in the department's incident procedure.
- Restore drill: at least once a quarter, restore the latest backup into a scratch project and run `backend/supabase/test/audit_live_policies.sql` against it.

## 5. Hosting and data residency

The current free-tier hosts were used for development. Before production use with real government data:

- Move the Supabase project to a paid plan in **`ap-south-1` (Mumbai)**, or to a MeitY-empanelled provider if the department requires one, with PITR enabled.
- Host the backend on a paid plan or the department's empanelled cloud. Set `TRUST_PROXY_HOPS` to the number of proxies in front of it.
- For the AI provider, choose models that have zero-data-retention endpoints (`AI_REQUIRE_ZDR=true` refuses all others). Record the provider in the department's privacy notice under the DPDP Act 2023.
- Commission a CERT-In-empanelled security audit (VAPT) of the deployed system and keep the certificate with this handover.
