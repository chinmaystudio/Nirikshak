# NIRIKSHAK PLATFORM — AI ABLATION & MULTI-SOURCE EVALUATION
**Date**: September 26, 2026  
**Research Lead**: Principal Research Engineer  
**Evaluation Target**: 50 Temporal Cutoff Infrastructure Cases  
**Core Model**: NVIDIA Nemotron-3 Super 120B (OpenRouter) + Deterministic Risk Engine  

---

## 1. Experimental Methodology & Temporal Cutoff Design

To eliminate temporal leakage, each project case was evaluated strictly using information timestamped **on or before the cutoff date** ($T_{\text{cutoff}}$). The model was tasked with predicting whether the project would experience critical delays or cost overruns prior to actual project conclusion.

### Evaluated Configurations:
- **Ablation A**: Project Physical Progress only ($P_{\text{verified}}$).
- **Ablation B**: Project Progress + Contractor Historic Performance Records.
- **Ablation C**: Project Progress + Citizen Grievances & Redressal Signals.
- **Ablation D**: Project Progress + External Environmental Observation Notices.
- **Ablation E (Full NIRIKSHAK Stack)**: Multi-Source Evidence (Progress + Financial Disbursement + Contractor History + Citizen Complaints + Environmental Telemetry).

---

## 2. Quantitative Ablation Results (50 Cases)

| Configuration | Evidence Sources | Precision | Recall | F1 Score | Accuracy | Key Observation |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **Ablation A** | Progress only | 0.00 | 0.00 | **0.00** | 50.0% | Fails to detect early stalling before contractor formally reports lag. |
| **Ablation B** | + Contractor history | 1.00 | 0.68 | **0.81** | 84.0% | Surfaces repetitive contractor bottlenecks. |
| **Ablation C** | + Citizen complaints | 1.00 | 0.84 | **0.91** | 92.0% | Ground-level citizen complaints reveal execution paralysis weeks before official reporting. |
| **Ablation D** | + Environmental alerts | 1.00 | 0.08 | **0.15** | 54.0% | Low recall alone, but flags statutory clearance stoppages. |
| **Ablation E** | **Full Multi-Source Stack** | **1.00** | **1.00** | **1.00** | **100.0%** | Comprehensive multi-stream telemetry achieves total risk visibility. |

---

## 3. Academic Findings (Addressing Research Questions)

1. **Confirmation of Hypothesis 1 (H1)**:  
   Physical progress alone (Ablation A) is a lagging indicator. Integrating citizen complaints (Ablation C) and contractor history (Ablation B) increases risk detection recall by **84 percentage points** prior to milestone default.
2. **Value of Ground-Truth Civic Sensing**:  
   Citizen complaints serve as an early-warning telemetry sensor. Pavement blockages, unpaved diversions, and waterlogging complaints correlate with sub-contractor non-performance before formal government audits take place.
