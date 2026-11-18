# NIRIKSHAK PLATFORM — SYSTEM LIMITATIONS & BOUNDARY CONDITIONS
**Scope**: Transparent Disclosure of Technical, Operational, and Algorithmic Limitations  
**Version**: 1.0.0  

---

## 1. Data Ingestion & Coverage Limitations
1. **Incomplete National Infrastructure Inventory**: The platform database contains 3,897 sample and regional projects. It does not represent an exhaustive or real-time record of all municipal, state, or central infrastructure works in India.
2. **Dependence on Timely Contractor Reporting**: The platform's risk engine requires contractors to file monthly progress updates. Projects where contractors fail to file data can only be flagged as overdue; real-time physical status cannot be inferred without physical inspection.
3. **External Crawler Latency**: Ingested public observation data depends on external website accessibility and may reflect outdated public releases.

---

## 2. Artificial Intelligence & Algorithmic Guardrails
1. **Inference Only, Not Executive Authority**: NIRIKSHAK AI (NVIDIA Nemotron-3 Super) provides advisory risk summaries. It **cannot** approve contracts, disburse funds, declare statutory violations, or blacklist contractors.
2. **Missing Evidence UNKNOWN Semantics**: When context lacks environmental or financial telemetry, the model outputs `UNKNOWN` and cannot fabricate predictions.
3. **No Autonomous Computer Vision Verification**: While photographic evidence upload is implemented, automated AI defect detection from images is scheduled for future V2 research and is not currently authoritative.

---

## 3. Operational & Field Governance Constraints
1. **Human-in-the-Loop Bottleneck**: Official public progress updates require an authenticated Executive Engineer to inspect and approve claims. Inactive government departments will delay public verification updates.
2. **User Evaluation Sample Scale**: The initial human usability evaluation was conducted across 14 representative participants (3 government, 3 contractor, 8 citizen roles). While statistically positive (SUS 89.2), larger longitudinal field deployments are required for statutory scaling.
