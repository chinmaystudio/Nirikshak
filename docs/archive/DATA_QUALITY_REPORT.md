# NIRIKSHAK PLATFORM — DATA QUALITY & PROVENANCE REPORT
**Date**: September 26, 2026  
**Auditor**: Principal Data Architect  
**Audit Population**: 3,897 Infrastructure Projects in PostgreSQL Database  

---

## 1. Quantitative Data Quality Audit

| Attribute / Field | Total Records | Missing / Null Count | Completeness Ratio | Data Quality Rating |
| :--- | :---: | :---: | :---: | :---: |
| **Project Name (`project_name`)** | 3,897 | **0** | **100.0%** | **EXCELLENT** |
| **Sanctioned Cost (`total_cost_inr_crore`)** | 3,897 | **36** | **99.08%** | **HIGH** |
| **Normalized Status (`normalized_status`)** | 3,897 | **0** | **100.0%** | **EXCELLENT** |
| **Administrative State (`state`)** | 3,897 | **0** | **100.0%** | **EXCELLENT** |
| **Physical Progress (`physical_progress_percent`)** | 3,897 | 3,887 | ~0.3% reported | Baseline (awaiting contractor filings) |
| **GPS Coordinates (`latitude`, `longitude`)** | 3,897 | 3,896 | ~0.1% geocoded | Core Pune packages geocoded |

---

## 2. Data Provenance & Attribution Integrity

- **Statutory Source Attribution**: Imported public projects are mapped with source metadata including `source_record_id` and `primary_source_url` (e.g., Ministry of Road Transport and Highways, Ministry of Housing and Urban Affairs).
- **Evidence Hierarchy Principle**:
  1. *Level 1 (Highest)*: Government Verified Progress (signed off by verified Executive Engineer via `reviewed_by = auth.uid()`).
  2. *Level 2*: Contractor Reported Evidence (site batch logs, drone imagery, invoices).
  3. *Level 3*: Citizen Ground Grievances (geolocated citizen feedback).
  4. *Level 4*: External Observational Ingestion (SearXNG / Scrapy crawler observations).
- **Invariant**: External observations or crawler data **NEVER** overwrite project values directly. They enter `source_observations` as verification candidates requiring official government audit.
