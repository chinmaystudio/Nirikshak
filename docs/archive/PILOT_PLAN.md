# NIRIKSHAK PLATFORM — OPERATIONAL PILOT DEPLOYMENT PLAN
**Target Authority**: Pune Infrastructure Monitoring Authority (PIMA) / Pune Municipal Corporation (PMC)  
**Pilot Duration**: 6 Weeks (Preparation: 1 Week; Active Execution: 4 Weeks; Post-Audit: 1 Week)  
**Scope**: 8 Active Greenfield & Brownfield Infrastructure Projects  

---

## 1. Pilot Cohort & Organizational Footprint

| Stakeholder Group | Sample Size | Primary Operational Mandate |
| :--- | :---: | :--- |
| **Government Authority** | 6 Officers (Executive & Site Engineers) | Triage incoming progress claims, conduct field verifications, triage citizen grievances. |
| **Contractor Organizations** | 3 Primary Infrastructure Firms | File weekly physical progress updates, upload batching plant evidence and drone captures. |
| **Citizen Evaluators** | 50 Registered Ward Residents | File ground-level observations, monitor verified project timelines. |

---

## 2. Key Performance Indicators (Pilot Success Criteria)

1. **Information Latency Reduction**: Time from physical site milestone completion to digital record reflection reduced from $\sim 30\text{ days}$ (paper bills) to $< 48\text{ hours}$.
2. **Review Cadence**: 100% of contractor progress claims reviewed and audited by verified engineers within 5 business days.
3. **Grievance Turnaround**: Average citizen complaint acknowledgment within 24 hours, resolution within 7 calendar days.
4. **Data Integrity**: Zero discrepancies between contractor-claimed progress and officially approved public progress.
5. **System Availability**: $\ge 99.9\%$ platform uptime with sub-second API responses.

---

## 3. Data Governance, Privacy & Statutory Consent
- **Consent Collection**: All citizen participants register with explicit digital consent under the Digital Personal Data Protection (DPDP) Act.
- **Redaction Protocol**: Personal phone numbers and email addresses are restricted to the grievance handling authority and never published in open data views.
- **Audit Retention**: All transactions, progress reviews, and contract awards are retained permanently in append-only PostgreSQL audit tables.
