# NIRIKSHAK PLATFORM — DISASTER RECOVERY & ROLLBACK PLAYBOOK
**Standard**: ISO/IEC 27031 Incident Readiness & Continuity Standard  
**RPO Target**: $< 1\text{ hour}$ (Point-In-Time PostgreSQL WAL Archival)  
**RTO Target**: $< 15\text{ minutes}$ (Vercel Instant Rollback & DB Failover)  

---

## 1. Backup Architecture & Snapshot Frequency

| Subsystem | Backup Mechanism | Retention Schedule | Storage Location |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | Automated Daily Physical Dumps + Continuous WAL Archiving | 30 Days Continuous | Supabase Multi-AZ Backup Storage |
| **Storage Evidence Media** | Cross-Region Replicated Object Storage (`progress-evidence`) | Permanent | AWS S3 / Supabase Storage Tier |
| **Database Migrations** | Versioned Git SQL Migrations (`001` to `022`) | Permanent | GitHub Repository (`main` branch) |
| **Environment Secrets** | Encrypted Vault / Vercel Environment Variables | Versioned by Release | Secure Team Secrets Manager |

---

## 2. Release Rollback Procedures

### Step 1: Frontend SPA Rollback (Instant)
If a critical UI regression occurs in production:
```bash
# Via Vercel CLI (or dashboard instant rollback to previous stable deployment)
vercel rollback <deployment-url>
```
Or via Git:
```bash
git checkout v1.0.0
npm run build
git push origin main
```

### Step 2: Database Migration Rollback
If a schema migration introduces instability:
```sql
-- Rollback 022_rls_security_hardening.sql (if needed)
DROP POLICY IF EXISTS "Government update progress" ON public.progress_updates;
-- Re-apply previous stable policy
```

### Step 3: Local Recovery & Re-Seeding
To restore development and testing environments to known good baselines:
```bash
cd backend
npx tsx scripts/seed-test-users.ts
npx tsx scripts/test-e2e-workflow.ts
```

---

## 3. Incident Escalation Contacts
- **Primary Technical Lead**: Systems Architect
- **Database Administrator**: Supabase Project Owner
- **Escalation SLA**: Critical P0 (Data Unavailability) $\le 30 \text{ min}$; P1 (Functional Bug) $\le 2 \text{ hours}$.
