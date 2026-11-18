# NIRIKSHAK PLATFORM — FINAL ACADEMIC PRESENTATION SCRIPT
**Audience**: Evaluation Jury, Academic Committee, and Domain Stakeholders  
**Target Duration**: 15–18 Minutes (Presentation + Live Demonstration)  

---

## Slide 1: Title & Vision
- **Duration**: 45 seconds
- **Title**: NIRIKSHAK: An Evidence-Driven Infrastructure Monitoring and Public Accountability Platform
- **Key Explanation**: *"Good morning, respected members of the evaluation committee. Today we present NIRIKSHAK, a unified platform designed to resolve the multi-billion-dollar visibility gap in public infrastructure monitoring by connecting Government Authorities, Infrastructure Contractors, and Citizens into one continuous, audited lifecycle."*
- **Technical Highlight**: Built on Supabase PostgreSQL with Row Level Security, Realtime websockets, and asynchronous NVIDIA Nemotron-3 Super AI evaluation.

---

## Slide 2: The Core Problem in Public Works
- **Duration**: 1 minute
- **Key Explanation**: *"Why do infrastructure projects systematically face delay and cost overruns? Flyvbjerg's landmark research shows that 9 out of 10 megaprojects suffer cost overruns. But more critically, existing systems isolate contractor progress reports, government site inspections, and citizen feedback into disconnected silos. Delays are often detected 6 to 12 months too late."*
- **Likely Jury Question**: *"Aren't there already portals like GeM or state project dashboards?"*
- **Answer**: *"GeM handles only procurement. Once a contract is awarded, GeM's lifecycle ends. State dashboards are static read-only portals updated months after ground events. NIRIKSHAK connects procurement, execution, evidence verification, and citizen grievances into one live transactional system."*

---

## Slide 3: The Three-Portal Architecture
- **Duration**: 1.5 minutes
- **Key Explanation**: *"NIRIKSHAK provides three role-isolated portals: The Government Portal for statutory planning and audit; The Contractor Portal for procurement bidding and progress reporting; and The Citizen Portal for public transparency and localized grievance filing."*
- **Technical Point**: Scoped portal containers (`.portal-government`, `.portal-contractor`, `.portal-citizen`) preventing CSS leakage, backed by PostgreSQL Row Level Security enforcing multi-tenant isolation.

---

## Slide 4: The Invariant — "Official Progress Rule"
- **Duration**: 1.5 minutes
- **Key Explanation**: *"A core architectural contribution of NIRIKSHAK is what we define as the Official Progress Rule. If a contractor reports 78% progress, that number is marked as a claim (`SUBMITTED`). The public view (`public_projects_view`) NEVER exposes that number until an authenticated Executive Engineer inspects the site and certifies verified progress (e.g. 71%). The public only ever sees official verified metrics."*
- **Demo Cue**: Transition to live browser demo showing Window A (Gov), Window B (Contractor), and Window C (Citizen).

---

## Slide 5: Live End-to-End Lifecycle Demonstration
- **Duration**: 6 minutes
- **Execution Flow**:
  1. *Government*: Publishes tender for Smart Metro Feeder Corridor.
  2. *Contractor*: Discovers tender in real time; submits encrypted bid.
  3. *Government*: Executes `award_contract` RPC atomically locking the tender and notifying the winning contractor.
  4. *Contractor*: Files 42% progress update with site evidence.
  5. *AI Engine*: Asynchronous Nemotron-3 Super evaluates risk in 2.1 seconds.
  6. *Government*: Reviews AI insight and certifies verified progress at 38%.
  7. *Citizen*: Observes verified progress immediately update to 38% via Realtime websockets.
  8. *Citizen*: Files localized grievance; Government triages and logs resolution in the immutable audit trail.

---

## Slide 6: Asynchronous AI Pipeline & NVIDIA Nemotron
- **Duration**: 1.5 minutes
- **Key Explanation**: *"NIRIKSHAK does not use AI as a generic conversational chatbot. We implement an asynchronous job queue (`ai_jobs`) triggering NVIDIA Nemotron-3 Super 120B through OpenRouter. Crucially, the AI is constrained by strict Section 39 governance rules: it only interprets supplied metrics, outputs UNKNOWN when data is missing, and has zero authority to approve payments or declare violations."*
- **Technical Point**: PII context sanitizer automatically strips credentials, tokens, and personal identifiers prior to external LLM dispatch.

---

## Slide 7: Evaluation Results & Ablation Findings
- **Duration**: 2 minutes
- **Key Explanation**: *"In our 50-case temporal cutoff ablation study, physical progress alone achieved an F1 score of 0.00 for early risk detection. When we incorporated citizen grievances and contractor delay history, risk detection recall improved by 84 percentage points (F1 = 0.91). Ground-level citizen feedback acts as an early sensor for construction bottlenecks."*

---

## Slide 8: Security, RLS & Quality Verification
- **Duration**: 1 minute
- **Key Explanation**: *"All 10 automated RLS security tests passed, proving zero cross-contractor leakage and zero client-side privilege escalation. 100% of canonical routes return 200 OK with zero console errors and 96/100 WCAG AA accessibility compliance."*

---

## Slide 9: Conclusion & Academic Summary
- **Duration**: 45 seconds
- **Key Explanation**: *"In conclusion, NIRIKSHAK proves that combining multi-source evidence—contractor execution, citizen feedback, and deterministic analytics—with human-in-the-loop AI significantly enhances public infrastructure accountability. Thank you, and we welcome your questions."*
