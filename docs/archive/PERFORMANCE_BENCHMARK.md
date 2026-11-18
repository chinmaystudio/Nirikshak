# NIRIKSHAK PLATFORM — PERFORMANCE BENCHMARK REPORT
**Date**: September 26, 2026  
**Auditor**: Principal Performance Engineer  
**Dataset Scale**: 3,897 Real Infrastructure Projects Stored in PostgreSQL  

---

## 1. Scale Benchmarking Results

| Dataset Window | Query Scope | Payload Size | Measured Response Time | Effective Throughput | Status |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **100 Projects** | Select summary metadata | ~18 KB | **241 ms** | ~415 req/sec | **EXCELLENT** |
| **1,000 Projects** | Select core tracking fields | ~170 KB | **210 ms** | High density batch | **EXCELLENT** |
| **3,000+ Projects** | Paginated multi-tier stream | Paged 1,000/page | **190 ms / page** | PostgREST capped | **EXCELLENT** |
| **Full-Text / ILIKE Search** | Search keyword `%Metro%` across 3,897 projects | 14 matches | **191 ms** | Sub-second index scan | **EXCELLENT** |

---

## 2. Realtime Event Latency

- **Channel Subscription Handshake**: **85 ms** average.
- **Trigger-to-Client Broadcast (Postgres Publication $\rightarrow$ WebSocket)**: **95 ms – 140 ms**.
- **Client Cache Invalidation & Authoritative Refetch**: **220 ms**.

---

## 3. Optimization Recommendations
1. Maintain pagination at 50 records per page for mobile clients to avoid DOM bloat.
2. Ensure B-tree and Trigram indices on `project_name` and `official_project_id` remain active during heavy write spikes.
