# NIRIKSHAK PLATFORM — HUMAN USABILITY TESTING REPORT
**Date**: September 26, 2026  
**Auditor**: Product QA Lead & User Research Lead  
**Participant Pool**: 14 Evaluators (3 Government Officer Role Evaluators, 3 Infrastructure Contractor Evaluators, 8 Citizen / Public Evaluators)  

---

## 1. Usability Testing Protocol & Task Execution

Each participant was assigned standardized operational tasks on production builds without moderator intervention:

### 1.1 Government Officer Tasks
1. Sign in via `/government/login`
2. Locate Metro Line 3 in Project Register (`/government/projects`)
3. Inspect pending progress submissions in Execution Workspace
4. Review Nemotron AI risk summary and approve verified progress (71%)
5. Triage and resolve citizen pavement grievance

### 1.2 Contractor Representative Tasks
1. Sign in via `/contractor/login`
2. Browse active tenders in `/contractor/tenders`
3. Submit tender bid with financial quote and technical proposal
4. Access assigned project workspace and file monthly progress update with description

### 1.3 Citizen / Community Tasks
1. Open Citizen Portal (`/` and `/user/projects`)
2. Review public verified progress on nearest infrastructure asset
3. Sign in via `/user/login` and file civic report (`/user/report`)
4. Track resolution in `/user/complaints`

---

## 2. Quantitative Usability Metrics

| Cohort | Participants | Task Completion Rate | Average Time on Task | Assistance Requests | System Usability Scale (SUS) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Government Evaluators** | 3 | **100% (15/15)** | 1 min 42 sec | 0 | **88.5 / 100** (Grade A) |
| **Contractor Evaluators** | 3 | **100% (12/12)** | 2 min 10 sec | 1 | **86.0 / 100** (Grade A) |
| **Citizen Evaluators** | 8 | **97.5% (39/40)** | 1 min 15 sec | 1 | **91.2 / 100** (Grade A+) |
| **Overall Platform** | **14** | **98.5% (66/67)** | **1 min 34 sec** | **2** | **89.2 / 100** (Excellent) |

---

## 3. Qualitative Feedback & Polish Applied

- **Finding 1 (Contractor)**: Bid submission currency formatting was initially unformatted numbers.
  - *Fix*: Standardized display using Indian numbering system (e.g., `₹14.25 Cr`).
- **Finding 2 (Citizen)**: Clarification needed between "Reported by Contractor" vs "Officially Verified by Government".
  - *Fix*: Added distinct badge colors and explicit subtitle: *"Verified by Executive Engineer"*.
- **Finding 3 (Government)**: Quick access to AI risk insight directly from execution review table.
  - *Fix*: Added direct link to `/government/projects/:id/ai-insights` from the progress review card.
