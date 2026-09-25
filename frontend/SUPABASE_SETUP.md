# NIRIKSHAK Supabase Configuration & Setup Guide

## 1. Project Reference
- **Project URL**: `https://dmkhkgqyzevhxpxsrgng.supabase.co`
- **Database Engine**: PostgreSQL 15+ with extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`, `postgis` (ready)
- **Tables Seeded**: 34 tables fully migrated
- **Initial Dataset**: 3,896 projects from `NIRIKSHAK_India_Infrastructure_Audit_Workbook_Pune_2000_to_2026.xlsx`

---

## 2. Storage Buckets
The following storage buckets are configured for artifact storage (never storing raw blobs in PostgreSQL):
- `project-public`: Public project photos and general infographics
- `project-documents`: DPRs, environmental impact assessments (EIA), and sanction orders
- `tender-documents`: Bid notices and BOQ tender packs
- `bid-documents`: Confidential contractor bid packets (restricted access)
- `contract-documents`: Executed agreement PDFs
- `progress-evidence`: Geotagged progress photos, drone survey imagery, and batching plant logs
- `inspection-evidence`: Government officer audit photos and non-compliance notices
- `complaint-evidence`: Citizen grievance photos
- `environment-evidence`: Air, noise, and water quality testing certificates

---

## 3. Realtime Channels
Realtime publication is enabled for immediate dashboard synchronization:
- `government:notifications:<org-id>`: Real-time progress submissions and urgent citizen escalations
- `contractor:notifications:<org-id>`: Progress approval/rejection decisions and contract awards
- `user:notifications:<user-id>`: Complaint resolution milestones
- `project:<project-id>`: Live updates on project verification status and physical progress changes
