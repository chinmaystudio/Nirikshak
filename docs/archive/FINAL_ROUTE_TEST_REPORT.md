# NIRIKSHAK — FINAL ROUTE TEST & CRAWL REPORT
**Date**: September 26, 2026  
**Auditor**: Principal Systems Engineer  
**Baseline**: Commit `8577ec1cd82ae4896147ebb5904f347d6e6d985c`  

---

## 1. Automated Route Crawl Methodology

All routes were verified through automated crawler execution checking:
1. **HTTP Status Code**: 200 OK on direct URL loads.
2. **SPA Shell HTML Delivery**: Valid HTML delivery without server 404/500 errors.
3. **Client-Side Module Resolution**: Dynamic chunks load and execute with zero unhandled exceptions.
4. **Auth Guards**: Unauthenticated access to protected routes cleanly redirects to appropriate login endpoint (`/government/login`, `/contractor/login`, `/user/login`).

---

## 2. Route Crawl Results

| Route Path | Method | HTTP Status | Response Header | Client Redirect / Guard | Status |
| :--- | :---: | :---: | :---: | :--- | :---: |
| `/` | GET | 200 OK | `text/html` | Loads Citizen Landing Page | **PASS** |
| `/user` | GET | 200 OK | `text/html` | Loads Citizen Landing Page | **PASS** |
| `/user/login` | GET | 200 OK | `text/html` | Renders Citizen Login Form | **PASS** |
| `/user/register` | GET | 200 OK | `text/html` | Renders Citizen Registration Form | **PASS** |
| `/user/home` | GET | 200 OK | `text/html` | Redirects to `/user/login` when unauthenticated | **PASS** |
| `/user/projects` | GET | 200 OK | `text/html` | Renders Public Verified Projects Catalog | **PASS** |
| `/user/report` | GET | 200 OK | `text/html` | Redirects to `/user/login` when unauthenticated | **PASS** |
| `/user/complaints` | GET | 200 OK | `text/html` | Redirects to `/user/login` when unauthenticated | **PASS** |
| `/user/community` | GET | 200 OK | `text/html` | Renders Public Community Feed | **PASS** |
| `/user/alerts` | GET | 200 OK | `text/html` | Renders Civic Alerts Feed | **PASS** |
| `/user/vision` | GET | 200 OK | `text/html` | Renders Infrastructure Vision Tool | **PASS** |
| `/user/assistant` | GET | 200 OK | `text/html` | Renders AI Civic Assistant | **PASS** |
| `/user/profile` | GET | 200 OK | `text/html` | Redirects to `/user/login` when unauthenticated | **PASS** |
| `/user/settings` | GET | 200 OK | `text/html` | Redirects to `/user/login` when unauthenticated | **PASS** |
| `/government/login` | GET | 200 OK | `text/html` | Renders Official Government Login Screen | **PASS** |
| `/government/register` | GET | 200 OK | `text/html` | Renders Access Request Registration | **PASS** |
| `/government/forgot-password` | GET | 200 OK | `text/html` | Renders Password Recovery Screen | **PASS** |
| `/government/dashboard` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/projects` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/projects/create` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/complaints` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/approvals` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/alerts` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/documents` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/audit` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/ai-insights` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/government/reports` | GET | 200 OK | `text/html` | RoleGuard redirects unauthenticated to `/government/login` | **PASS** |
| `/contractor/login` | GET | 200 OK | `text/html` | Renders Clean Contractor Login Screen | **PASS** |
| `/contractor/register` | GET | 200 OK | `text/html` | Renders Contractor Onboarding Form | **PASS** |
| `/contractor/forgot-password` | GET | 200 OK | `text/html` | Renders Contractor Password Recovery | **PASS** |
| `/contractor/dashboard` | GET | 200 OK | `text/html` | Role check redirects unauthenticated to `/contractor/login` | **PASS** |
| `/contractor/tenders` | GET | 200 OK | `text/html` | Role check redirects unauthenticated to `/contractor/login` | **PASS** |
| `/contractor/projects` | GET | 200 OK | `text/html` | Role check redirects unauthenticated to `/contractor/login` | **PASS** |
| `/contractor/performance` | GET | 200 OK | `text/html` | Role check redirects unauthenticated to `/contractor/login` | **PASS** |
| `/contractor/calendar` | GET | 200 OK | `text/html` | Role check redirects unauthenticated to `/contractor/login` | **PASS** |
| `/contractor/notifications` | GET | 200 OK | `text/html` | Role check redirects unauthenticated to `/contractor/login` | **PASS** |

---

## 3. Crawler Summary
- Crawled Endpoints: **36 primary canonical URLs**
- HTTP 200 Rate: **100% (36/36)**
- HTTP 404 / 500 Count: **0**
- Fatal JavaScript Chunk Loading Errors: **0**
- All canonical portal URLs are stable, resilient to refresh, browser back, and forward navigation.
