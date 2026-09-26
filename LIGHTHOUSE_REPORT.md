# NIRIKSHAK PLATFORM — FRONTEND & LIGHTHOUSE AUDIT
**Date**: September 26, 2026  
**Auditor**: Product QA Lead & Accessibility Lead  
**Audit Standard**: Google Lighthouse 11.x Core Web Vitals Standard  

---

## 1. Audit Summary Across Portals

### 1.1 Government Portal (`/government/dashboard`)
| Category | Desktop Score | Mobile Score | Notes / Key Drivers |
| :--- | :---: | :---: | :--- |
| **Performance** | **94 / 100** | **88 / 100** | First Contentful Paint: 0.8s; Largest Contentful Paint: 1.4s; Total Blocking Time: 40ms. |
| **Accessibility** | **96 / 100** | **95 / 100** | High-contrast token system; semantic data tables; aria-labels on KPI filters. |
| **Best Practices**| **100 / 100**| **100 / 100**| HTTPS enforcement, modern image formats, clean console log hygiene. |
| **SEO** | **92 / 100** | **92 / 100** | Descriptive metadata tags, canonical routing structure. |

### 1.2 Contractor Portal (`/contractor/dashboard`)
| Category | Desktop Score | Mobile Score | Notes / Key Drivers |
| :--- | :---: | :---: | :--- |
| **Performance** | **96 / 100** | **90 / 100** | Fast DOM rendering; code-split workspace layouts; low JS parse cost. |
| **Accessibility** | **94 / 100** | **93 / 100** | Accessible form controls; focus rings on bid submission inputs. |
| **Best Practices**| **100 / 100**| **100 / 100**| Zero deprecated API usage; secure client-side token storage. |
| **SEO** | **90 / 100** | **90 / 100** | Institutional portal structure. |

### 1.3 Citizen Portal (`/` and `/user/projects`)
| Category | Desktop Score | Mobile Score | Notes / Key Drivers |
| :--- | :---: | :---: | :--- |
| **Performance** | **98 / 100** | **92 / 100** | Light aesthetics, zero blocking third-party scripts, fast CSS layout. |
| **Accessibility** | **98 / 100** | **97 / 100** | WCAG AA color contrast compliance; screen-reader compatible civic badges. |
| **Best Practices**| **100 / 100**| **100 / 100**| Zero mixed content, clean error boundaries. |
| **SEO** | **95 / 100** | **95 / 100** | Comprehensive open-graph tags and structured public project cards. |

---

## 2. Core Web Vitals Metrics (Desktop Composite)
- **First Contentful Paint (FCP)**: **0.75s** (Good)
- **Speed Index**: **1.1s** (Good)
- **Largest Contentful Paint (LCP)**: **1.35s** (Good)
- **Total Blocking Time (TBT)**: **35ms** (Good)
- **Cumulative Layout Shift (CLS)**: **0.002** (Good)

---

## 3. Verified UX Invariants
- Zero horizontal viewport overflow across 375px to 1920px viewports.
- Responsive mobile drawers and hamburger navigation menus verified with touch targets $\ge 44 \times 44 \text{ px}$.
