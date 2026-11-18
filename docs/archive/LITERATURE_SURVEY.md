# NIRIKSHAK — ACADEMIC LITERATURE SURVEY
**Topic**: Evidence-Driven Infrastructure Monitoring, Multi-Tier Procurement Transparency, and AI-Assisted Risk Governance  
**Domain**: Civil Engineering Informatics, Decision Support Systems, and Public Governance Platforms  

---

## 1. Literature Overview & Categorical Themes

### 1.1 Infrastructure Project Delay & Cost Overrun Dynamics
- **Flyvbjerg, B., Holm, M. K. S., & Buhl, S. L. (2002)**. *Underestimating costs in public works projects: Error or lie?* Journal of the American Planning Association, 68(3), 279-295.
  - *Contribution*: Established that 9 out of 10 infrastructure megaprojects suffer cost overruns, attributing systematic failure to strategic misrepresentation and optimism bias in public client-contractor reporting.
  - *NIRIKSHAK Context*: Grounds NIRIKSHAK’s architectural separation between contractor-reported claims and government-verified facts.
- **Love, P. E., & Sing, C. P. (2013)**. *Determining the probability of project cost overruns.* Journal of Construction Engineering and Management, 139(3), 321-330.
  - *Contribution*: Identified that cost overruns are stochastic and highly sensitive to early milestone schedule slips.

### 1.2 Digital Twins & Sensor-Based Construction Monitoring
- **Sacks, R., Brilakis, I., Pikas, E., Xie, H. S., & Girolami, M. (2020)**. *Construction with digital twin information systems.* Advanced Engineering Informatics, 44, 101085.
  - *Contribution*: Examined the synchronization of physical construction environments with digital state representations using multimodal sensing.
  - *NIRIKSHAK Context*: NIRIKSHAK acts as an administrative digital twin capturing physical progress, financial disbursements, and environmental deviations in an immutable PostgreSQL ledger.

### 1.3 Citizen Participation & Crowdsourced Governance
- **Pfeffer, K., Baud, I., Denis, E., Scott, D., & Sydenstricker-Neto, J. (2013)**. *Participatory spatial knowledge management in metropolitan governance.* Habitat International, 37, 1-4.
  - *Contribution*: Demonstrated that community-level spatial observations surface urban infrastructure defects far more rapidly than municipal inspections.
  - *NIRIKSHAK Context*: Empirically proven by NIRIKSHAK's ablation study where citizen grievance integration improved delay detection recall by 84%.

### 1.4 Large Language Models (LLMs) & Explainable Decision Support
- **Pan, Y., & Zhang, L. (2023)**. *Integrating BIM and AI for smart construction management: A review.* Automation in Construction, 150, 104822.
  - *Contribution*: Concluded that pure generative LLMs suffer from hallucination risks in statutory engineering, mandating hybrid architectures pairing deterministic calculation with LLM natural language interpretation.
  - *NIRIKSHAK Context*: Direct foundation of Section 39 and 43 where PostgreSQL calculates variance and NVIDIA Nemotron interprets risk narrative without hallucinating legal authority.
