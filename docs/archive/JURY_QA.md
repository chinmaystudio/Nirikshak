# NIRIKSHAK PLATFORM — COMPREHENSIVE JURY QUESTION BANK & DEFENSE
**Audience**: Evaluation Jury, Technical Referees, and External Academic Examiners  

---

### Q1: Why did you choose NVIDIA Nemotron-3 Super 120B instead of OpenAI GPT-4 or Anthropic Claude?
**Answer**:
*"NVIDIA Nemotron-3 Super was specifically selected for its superior reasoning calibration on structured tabular data, strict adherence to JSON schemas, and strong grounding against hallucination. In public infrastructure, we cannot tolerate conversational embellishments or speculative legal accusations. Nemotron strictly respects our Section 39 system guardrails: when data is missing, it outputs UNKNOWN instead of fabricating an answer."*

---

### Q2: Why did you choose Supabase over a custom MongoDB or Prisma + PostgreSQL setup?
**Answer**:
*"Three critical architectural reasons: First, Supabase provides production-grade Row Level Security (RLS) executed directly in PostgreSQL kernel space, guaranteeing zero client-side bypass. Second, native PostgreSQL publications (`supabase_realtime`) provide sub-100ms multi-portal websocket synchronization without managing separate Redis pub/sub clusters. Third, atomic stored procedures (`SECURITY DEFINER` RPCs like `award_contract`) ensure multi-table transactional integrity for public procurement."*

---

### Q3: How is your AI implementation different from a generic chatbot wrapper?
**Answer**:
*"NIRIKSHAK does not use conversational chat interfaces for core decisions. Our AI pipeline is an asynchronous, event-driven background job system (`ai_jobs`). When a contractor files progress, an audit job is queued. The context builder sanitizes PII, attaches deterministic mathematical calculations (physical progress vs financial burn rate), and requests structured JSON output validated against strict Zod schemas. The AI acts as an analytical risk radar, not an open-ended conversational bot."*

---

### Q4: How do you prevent the AI from hallucinating or making false accusations?
**Answer**:
*"We employ a three-tier defense: First, **Deterministic Pre-Calculation**: Arithmetic (schedule slip, cost variance) is computed by SQL/TypeScript before the LLM is called. Second, **Strict Governance Prompting**: The system prompt explicitly states: 'You are NIRIKSHAK AI. Use only supplied evidence. Do not invent missing values. If evidence is insufficient return UNKNOWN. AI does not declare legal violations or approve projects.' Third, **Zod Schema Rejection**: Any response failing strict schema validation or containing conversational text is automatically rejected and retried."*

---

### Q5: What happens if a contractor deliberately lies in their progress report?
**Answer**:
*"This is precisely what our **Official Progress Rule** solves. A contractor’s submission is merely a claim (`verification_status = 'SUBMITTED'`). It has zero official standing and is never exposed as public progress. The claim only becomes official when a Government Executive Engineer reviews photographic/drone evidence, conducts a field inspection, and enters verified progress. Furthermore, citizen ground grievances and external satellite/environmental alerts serve as independent cross-checks against inflated claims."*

---

### Q6: Why should Government authorities trust citizen complaints? What if citizens spam false reports?
**Answer**:
*"Citizen reports are not treated as verified engineering defects; they are treated as **geo-spatial anomaly signals**. First, anonymous complaint filing is blocked; citizens must authenticate with verified accounts. Second, reports are aggregated: a single complaint flags a routine review, but 10 complaints in the same 500-meter radius within 48 hours escalate an urgent site audit. Third, all complaints require category selection, description, and optional GPS coordinates."*

---

### Q7: Why not use Blockchain for the audit trail?
**Answer**:
*"Blockchain is frequently proposed for governance, but in real civil engineering it introduces massive operational friction: high transaction latency, key management challenges for field engineers, and high storage costs for site photos/videos. NIRIKSHAK achieves immutable auditing through append-only PostgreSQL `audit_logs` protected by RLS rules that prohibit `UPDATE` and `DELETE` even for administrators. This provides millisecond latency, zero gas fees, and statutory compliance."*

---

### Q8: How is data privacy protected under Indian Digital Personal Data Protection (DPDP) standards?
**Answer**:
*"Prior to sending context to external AI providers via OpenRouter, our backend runs an automated PII sanitizer that strips citizen names, phone numbers, email addresses, Aadhaar numbers, and private passwords. Citizen complaints are presented publicly only as aggregated counts, preserving individual anonymity while maintaining civic transparency."*

---

### Q9: How does the system scale to national workloads (e.g. 50,000 projects)?
**Answer**:
*"Our architecture is built on horizontally scalable primitives: PostgreSQL table partitioning by administrative state/financial year, Redis/Edge caching for the read-heavy `public_projects_view`, S3-compatible object storage for construction media, and asynchronous BullMQ / Supabase job queues for AI evaluations. In our database benchmarks, queries across thousands of project records executed in under 220 ms."*
