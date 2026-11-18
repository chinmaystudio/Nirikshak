# NIRIKSHAK — DESCRIPTIVE COMPARATIVE ANALYSIS
**Purpose**: Academic & Technical Comparison of NIRIKSHAK with Existing Infrastructure Management Paradigms  
**Standard**: Objective, Evidence-Grounded Analysis (Avoiding Hyperbole)  

---

## 1. Comparative Architectural Matrix

| Functional Capability | National Tender Portals (e.g. GeM, CPPP) | Commercial Construction PM (e.g. Procore, Primavera) | Public Dashboard Portals (e.g. MoSPI, City Dashboards) | **NIRIKSHAK Platform (v1.0)** |
| :--- | :---: | :---: | :---: | :---: |
| **Procurement Workflow** | Full Tender & Bidding | RFIs & Submittals only | Read-only static data | **Full Lifecycle (Tender $\rightarrow$ Bid $\rightarrow$ Atomic Award)** |
| **Progress Execution** | Not supported | Detailed WBS / Gantt | High-level summary | **Milestone-Based Progress + Evidence** |
| **Citizen Feedback** | Not supported | Restricted to internal teams | Basic complaint forms (often unlinked) | **Integrated Geo-Tagged Grievances Linked to Projects** |
| **Official vs Reported State**| N/A | Single reported state | Single published state | **Strict Invariant (Contractor Claim vs Gov Verified vs Public View)** |
| **AI Decision Support** | Keyword search | Predictive analytics (proprietary) | Absent | **OpenRouter NVIDIA Nemotron-3 Super 120B (Hybrid Deterministic + LLM)** |
| **Data Tenancy & Security** | Departmental | Enterprise RBAC | Public open access | **PostgreSQL Multi-Role RLS (Gov, Contractor, Citizen)** |
| **Realtime Updates** | Polling / batch | WebSocket / sync | Periodic batch ingestion | **Supabase Realtime Postgres Publications** |

---

## 2. Key Differentiating Contributions

1. **Continuous Tri-Party Integration**:  
   Unlike specialized procurement portals that terminate upon contract award, or construction PM tools that exclude public civic feedback, NIRIKSHAK demonstrates one continuous lifecycle connecting planning, procurement, execution, field inspection, and public grievance resolution.

2. **The "Official Progress Rule" Invariant**:  
   Prevents unverified contractor progress claims from appearing as verified public records. Public transparency projections are tied strictly to signed engineering verification.

3. **Hybrid Governance AI**:  
   Rather than treating the LLM as an autonomous agent that approves payments or declares violations, NIRIKSHAK uses NVIDIA Nemotron strictly as an explainable risk interpreter grounded in supplied database metrics.
