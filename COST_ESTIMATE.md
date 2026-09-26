# NIRIKSHAK PLATFORM — CLOUD INFRASTRUCTURE COST ESTIMATES
**Scope**: Operational Cost Projections Across 4 Deployment Horizons  
**Currency**: USD ($) and Indian Rupees (₹ @ ₹84 / USD)  

---

## 1. Cost Model Assumptions
- **Supabase**: Pro tier ($25/mo) handles up to 100,000 MAU and 8GB database space; Enterprise tier required beyond 1,000 projects.
- **Vercel**: Pro tier ($20/mo/seat) provides 1TB bandwidth and high-performance CDN edge delivery.
- **OpenRouter / NVIDIA Nemotron-3 Super 120B**: Model priced at $\sim \$0.80$ per 1M input tokens and $\$2.40$ per 1M output tokens. Average analysis: 2,500 tokens ($\sim \$0.003$ per analysis).
- **Storage**: AWS S3 / Supabase storage priced at $\$0.021$ per GB/mo for site photos and drone imagery.

---

## 2. Tiered Cost Projections

| Infrastructure Resource | Pilot Scale (8 Projects) | 100 Active Projects | 1,000 Active Projects | 10,000 Projects (National) |
| :--- | :---: | :---: | :---: | :---: |
| **Supabase PostgreSQL & Realtime**| $25 / mo | $25 / mo | $250 / mo | $1,200 / mo |
| **Vercel Edge Hosting** | $20 / mo | $40 / mo | $150 / mo | $600 / mo |
| **OpenRouter AI (Nemotron-3 Super)**| $5 / mo | $35 / mo | $350 / mo | $3,500 / mo |
| **Media & Evidence Storage (S3)** | $2 / mo | $25 / mo | $250 / mo | $2,500 / mo |
| **Crawler & Verification Compute** | Free / Local | $20 / mo | $80 / mo | $400 / mo |
| **Total Monthly Cost (USD)** | **$52 / mo** | **$145 / mo** | **$1,080 / mo** | **$8,300 / mo** |
| **Total Monthly Cost (INR)** | **₹4,368 / mo** | **₹12,180 / mo** | **₹90,720 / mo** | **₹6,97,200 / mo** |

---

## 3. Cost-Benefit Analysis
At national scale ($10,000$ active projects), the total annual operational cost is approximately **₹83.6 Lakhs ($99,600)**. Compared to public infrastructure budgets where a single urban flyover costs ₹150+ Crore, identifying even one month of contractor delay early yields millions in prevented escalation costs, representing a $>100\times$ statutory ROI.
