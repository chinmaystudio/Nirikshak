# NIRIKSHAK PLATFORM — DEMO RECOVERY & CONTINGENCY PLAN
**Purpose**: Operational fallback procedures for live jury presentations, academic reviews, and product demonstrations.  
**Rule**: Never fabricate artificial results. All fallbacks utilize deterministic database guarantees and verifiable offline assets.

---

## 1. Contingency Matrix

| Risk / Failure Mode | Likelihood | Impact | Immediate Recovery Action |
| :--- | :---: | :---: | :--- |
| **Realtime WebSocket Drop** | Low | Medium | **Fallback to Manual Refresh**: Press `F5` / click portal reload button. Explain that client optimistic updates automatically reconcile against PostgreSQL authoritative state. |
| **OpenRouter / AI Latency (>10s)** | Medium | Low | **Deterministic Risk Engine**: The backend automatically falls back to deterministic rule-based analysis (calculating physical vs. financial variance and schedule slip) if the LLM exceeds latency thresholds. Emphasize that deterministic safety baselines take precedence over LLM inferences in statutory governance. |
| **Network Disconnection / Offline** | Low | High | **Local Dev Stack**: Run both frontend (`localhost:5173`) and backend (`localhost:4000`) locally. The platform operates self-contained with local Supabase / PostgreSQL instances. |
| **Subagent / Browser Glitch** | Low | Medium | **Dual-Profile Browser Windows**: Pre-open 3 browser profiles: (1) Chrome incognito for Government, (2) Edge for Contractor, (3) Chrome standard for Citizen. Avoid switching cookies in the same session. |
| **Demo Project State Corrupted** | Low | Low | **One-Command Re-Seed**: Run `npx tsx scripts/seed-test-users.ts` from `backend/` to instantly restore clean test accounts and baseline relationships. |

---

## 2. Step-by-Step Fallback Procedures

### Procedure A: If OpenRouter AI Fails or Times Out
1. Explain: *"In production statutory engineering, AI models may experience network timeouts. NIRIKSHAK is architected with a deterministic fail-safe."*
2. Point to the UI: The risk radar displays calculated database variance:
   - Physical Progress vs. Planned Milestone Gap
   - Outlay vs. Expenditure Burn Rate
3. Show that the Government verification workflow is **NOT blocked** by AI outages.

### Procedure B: If Realtime Notification Fails to Pop Up
1. Explain: *"NIRIKSHAK's Realtime architecture uses Postgres publications. In low-bandwidth network environments, client stores fallback to polling reconciliation on view focus."*
2. Switch tabs or click the project refresh icon.
3. Show that the authoritative database record updated accurately.

### Procedure C: If Internet Fails Completely
1. Switch to pre-recorded HD demo video (3–5 minutes walk-through of the exact 10-step flow stored in `docs/final-evidence/demo-video-walkthrough.mp4`).
2. Walk the jury through the architectural diagrams in `docs/final-evidence/` and code implementations in `backend/supabase/migrations/021_procurement_progress_ai.sql`.
