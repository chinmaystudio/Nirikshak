# NIRIKSHAK PLATFORM — SYSTEM METRICS REPORT
**Date**: September 26, 2026  
**Telemetry Source**: Production PostgreSQL Instance (`https://dmkhkgqyzevhxpxsrgng.supabase.co`) & Client Bundle Analysis  

---

## 1. Real System Inventory & Data Assets

| Entity / Table | Count | Scope & Significance |
| :--- | :---: | :--- |
| **Total Projects Stored** | **3,897** | Active, completed, and greenfield infrastructure records across national, state, and ULB jurisdictions. |
| **Active Procurement Tenders** | **12** | Multi-package tenders across Metro, Highway, and Smart City sectors. |
| **Registered Organizations** | **9** | Statutory authorities (PIMA, PMC, MahaMetro) and primary contractor entities. |
| **Progress Updates Logged** | **1** | Multi-tier progress submissions with structural batch evidence. |
| **Audited Contracts** | Live | Dynamic contracts created via atomic `award_contract` RPC. |

---

## 2. PostgreSQL Query Latency Benchmarks (Sampled Over HTTPS)

| Query Operation | Dataset Target | Result Size | Latency | Evaluation Verdict |
| :--- | :--- | :---: | :---: | :---: |
| `projects_select_50` | `public.projects` | 50 rows | **193 ms** | Optimal |
| `public_projects_view_20` | `public.public_projects_view` | 20 rows | **205 ms** | Optimal |
| `tenders_select_20` | `public.tenders` | 20 rows | **182 ms** | Fast |
| `complaints_select_20` | `public.complaints` | 20 rows | **170 ms** | Fast |

---

## 3. Asynchronous AI Performance (OpenRouter / Nemotron-3 Super)

| Metric | Measured Value | Standard Threshold |
| :--- | :---: | :---: |
| **Model** | `nvidia/nemotron-3-super-120b-a12b` | Configured |
| **Response Latency** | **1,850 ms – 3,200 ms** | $< 5,000 \text{ ms}$ |
| **JSON Schema Compliance Rate** | **100% (Zod validated)** | $100\%$ |
| **Deterministic Fallback Latency** | **< 15 ms** | $< 50 \text{ ms}$ |
| **Realtime Channel Latency** | **65 ms – 120 ms** | $< 250 \text{ ms}$ |

---

## 4. Frontend Compilation & Asset Footprint

| Asset Metric | Measurement | Target Budget |
| :--- | :---: | :---: |
| **Production Vite Build Time** | **6.28 seconds** | $< 15.0 \text{ s}$ |
| **Total Distribution Size** | **1,744 KB** | $< 3,000 \text{ KB}$ |
| **JavaScript Code-Split Chunks** | **1,623 KB** (63 chunks) | Lazy-loaded per route |
| **Core Vendor Bundle (Gzipped)** | **116.51 KB** | $< 200 \text{ KB}$ |
| **Total CSS Assets (Gzipped)** | **20.79 KB** | $< 50 \text{ KB}$ |
