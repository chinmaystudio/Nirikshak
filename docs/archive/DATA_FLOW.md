# NIRIKSHAK Cross-Portal Data Flow Architecture

## 1. Architectural Philosophy
1. **Supabase PostgreSQL is the System of Record**: All entity mutations are persisted to PostgreSQL.
2. **AI is NOT the Database & NOT the Decision Maker**: The AI layer processes authorized snapshots and provides structured risk advisories; government officers make binding decisions.
3. **Reported vs. Verified vs. Public**: Unverified contractor submissions are never exposed as official progress.

---

## 2. End-to-End Data Flows

### 2.1 Progress Submission & Verification Flow
```
[Contractor Portal]
       │
       ▼ (Submits progress update with photos & geo-coordinates)
[POST /api/progress/submit]
       │
       ▼
[public.progress_updates] (verification_status = 'SUBMITTED')
       │
       ├──► [Supabase Realtime Channel: 'government:notifications']
       │
[Government Portal] (Inspects submitted evidence)
       │
       ▼ (Officer verifies actual completion)
[POST /api/progress/review]
       │
       ▼
[Stored Procedure: approve_progress_update]
       ├── Updates progress_updates (verification_status = 'APPROVED')
       ├── Updates project_milestones (verified_progress = X%)
       ├── Recalculates projects.physical_progress_percent
       ├── Writes audit_logs record
       └── Generates contractor notification
       │
       ▼
[public_projects_view] (Reflects new verified progress)
       │
       ▼
[Citizen Portal] (Displays authoritative progress indicator)
```

---

### 2.2 Citizen Complaint & Resolution Flow
```
[Citizen / User Portal]
       │
       ▼ (Filer selects project, uploads photo, enters description)
[POST /api/complaints]
       │
       ├── Generates human-readable reference number (NIR-CMP-YYYY-XXXXXX)
       ├── Inserts into public.complaints (status = 'SUBMITTED')
       └── Stores evidence paths in public.complaint_evidence
       │
       ▼
[Immediate Reference Return] ──► Citizen tracks status in real-time
       │
[Government Portal]
       ├── Triages grievance and assigns department officer
       ├── Updates public.complaint_updates timeline
       └── Marks status = 'RESOLVED' upon verified remedial action
       │
       ▼
[Realtime / Notifications] ──► Citizen notified of resolution
```

---

### 2.3 Procurement & Contract Award Flow
```
[Government Officer]
       │
       ▼ Creates Tender with BOQ specifications
[public.tenders] (status = 'PUBLISHED')
       │
[Contractor Portal]
       │
       ▼ Bids submitted before due date
[public.tender_bids] (status = 'SUBMITTED')
       │
[Government Evaluation]
       │
       ▼ Award Contract to selected contractor
[Stored Procedure: award_contract]
       ├── Sets tender status = 'AWARDED'
       ├── Creates public.contracts record
       ├── Adds contractor to public.project_organizations
       └── Contractor portal unlocks milestone submission workspace
```
