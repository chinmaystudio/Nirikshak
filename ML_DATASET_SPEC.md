# NIRIKSHAK PLATFORM — MACHINE LEARNING DATASET SPECIFICATION
**Version**: 1.0.0  
**Domain**: Predictive Infrastructure Risk, Schedule Slip, and Cost Overrun Modeling  
**Target Schema**: Temporal-Cutoff Supervised Learning Dataset  

---

## 1. Feature Engineering & Schema Definitions

| Feature Name | Data Type | Source Table | Observation Timestamp | Missing Data Strategy | Leakage Risk & Prevention |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sector_encoded` | Categorical (One-Hot) | `projects.sector` | $T_{\text{award}}$ | Mode imputation | None (Fixed at inception) |
| `sanctioned_cost_cr` | Continuous ($\mathbb{R}^+$) | `projects.total_cost_inr_crore` | $T_{\text{sanction}}$ | Median imputation | None (Baseline financial ledger) |
| `planned_duration_months`| Integer ($\mathbb{Z}^+$) | `contracts.scheduled_*` | $T_{\text{award}}$ | Sector median | None (Contractual timeline) |
| `award_delay_days` | Integer ($\mathbb{Z}^+$) | `tenders.award_date - bid_due` | $T_{\text{award}}$ | Zero | None (Pre-execution event) |
| `verified_progress_pct`| Percentage ($[0, 100]$) | `progress_updates.verified_progress` | $\le T_{\text{cutoff}}$ | Zero | **CRITICAL**: Use only reviews before $T_{\text{cutoff}}$ |
| `financial_disbursement_pct`| Percentage ($[0, 100]$) | `contracts / finance` | $\le T_{\text{cutoff}}$ | Zero | **CRITICAL**: Use only payments before $T_{\text{cutoff}}$ |
| `progress_variance` | Continuous ($\mathbb{R}$) | $\text{Expected} - \text{Verified}$ | $\le T_{\text{cutoff}}$ | Calculated | **CRITICAL**: Compute using baseline schedule |
| `unresolved_complaints` | Integer ($\mathbb{Z}^+$) | `complaints` | $\le T_{\text{cutoff}}$ | Zero | Exclude complaints filed after cutoff |
| `contractor_delay_history` | Continuous ($[0, 1]$) | `organizations.historical_score` | $\le T_{\text{cutoff}}$ | Neutral 0.50 | Exclude subsequent contractor defaults |
| `environmental_alerts_count`| Integer ($\mathbb{Z}^+$) | `source_observations` | $\le T_{\text{cutoff}}$ | Zero | Timestamp strictly bounded by cutoff |

---

## 2. Prediction Targets (Ground Truth Labels)

| Target Label | Variable Type | Operational Definition |
| :--- | :--- | :--- |
| `target_delay_exceeded_15pct`| Binary ($\{0, 1\}$) | $1$ if $\text{Actual Duration} > \text{Planned Duration} \times 1.15$ |
| `target_cost_overrun_gt_10pct`| Binary ($\{0, 1\}$) | $1$ if $\text{Final Cost} > \text{Sanctioned Outlay} \times 1.10$ |
| `target_stalled_project` | Binary ($\{0, 1\}$) | $1$ if zero physical progress registered for $> 180$ consecutive days |

---

## 3. Strict Temporal Isolation Rules
1. **Zero Future Lookahead**: No training row may incorporate data timestamped after its specific evaluation cutoff date $T_{\text{cutoff}}$.
2. **Revision Partitioning**: If revised completion dates were sanctioned after $T_{\text{cutoff}}$, they must not be reflected in features representing status at $T_{\text{cutoff}}$.
