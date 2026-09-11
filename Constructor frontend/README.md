# NIRIKSHAN — Public Infrastructure Transparency & Citizen Portal

**Nirikshan** is a citizen-facing platform for public infrastructure transparency and accountability: discover nearby government projects, inspect budgets and contractor performance, **identify any infrastructure with your camera (Nirikshan Vision)**, report issues with AI-assisted verification, track complaints with SLA escalation, participate in community verification, and receive safety and project alerts.

**Stack:** React 18 + TypeScript (strict) + Vite + Tailwind CSS. Hash-based typed router, typed mock services, no state library (typed external store + `useSyncExternalStore`).

---

## Run it

```bash
npm install
npm run dev         # Vite dev server → http://localhost:3000
npm run typecheck   # tsc --noEmit (strict)
npm run build       # typecheck + vite build → dist/
npm start           # node server.js → serves dist/ at http://localhost:3000
npm run preview     # vite preview of the build
```

`server.js` (plain Node ESM, zero dependencies) serves the production build with correct MIME types, immutable asset caching, SPA fallback and a friendly `EADDRINUSE` message. Optional env (`.env.example`): `VITE_API_BASE_URL` (leave empty for demo mode), `PORT`.

### Demo credentials

| Step | Value |
| --- | --- |
| Login mobile number | any 10-digit number (e.g. `9876543210`) |
| OTP (demo) | `1234` |

---

## Modules

```
Login / Register (OTP)          → #/login  #/register
Home dashboard                  → #/home
Nearby Projects (map + list)    → #/projects
Project Transparency Dossier    → #/projects/:id   (Overview / Financials /
                                                   Contractor / Progress /
                                                   Timeline / Documents)
Nirikshan Vision                → #/vision  #/vision/result/:id  #/vision/history
Report an Issue (7-step, AI)    → #/report  #/report/success
My Complaints + Case File       → #/complaints  #/complaints/:id
Community verification          → #/community  #/community/:id
Alerts centre                   → #/alerts  #/alerts/:id
AI Civic Assistant              → #/assistant (+ floating widget)
Profile / Settings              → #/profile  #/settings
```

---

## Architecture

```text
src/
├── app/
│   ├── App.tsx               Shell: providers wiring, chrome, route table + guards
│   ├── router.tsx            Typed hash router (parse, match, navigate, useLocation)
│   └── providers/store.ts    Typed external store (localStorage) + useAppState
├── components/
│   ├── common/               Icon, Button, StatusBadge, ProgressBar, StatCard,
│   │                         PageHeader, Modal (+ConfirmDialog), Drawer, Tabs,
│   │                         ToastViewport, EmptyState, LoadingState, ErrorState
│   ├── layout/               GovernmentBar, Header, Navigation, Footer,
│   │                         MobileNavigation, PolicyDialog
│   ├── projects/             ProjectCard, ProjectMap, ProjectHeader, ProjectTimeline,
│   │                         ProjectProgress, FinancialSummary, ContractorInfo,
│   │                         ProjectDocuments
│   ├── complaints/           ComplaintCard (+Evidence/Resolution/Officer/Feedback),
│   │                         ComplaintTimeline (+Stepper), SLAIndicator (+EscalationPath)
│   ├── report/               ReportStepper, IssueCategoryGrid, LocationPicker,
│   │                         EvidenceUploader, AIVerification
│   ├── community/            CommunityIssueCard, ConfirmationMeter, CommentsSection
│   ├── alerts/               AlertCard
│   ├── vision/               VisionCamera, InfrastructureDetails, VisionResultView
│   └── ai/                   AssistantWidget (FABs, widget, ChatPanel)
├── features/
│   ├── reporting/reportFlow.ts                typed report-prefill bridge
│   └── infrastructure-vision/visionFlow.ts    Vision → Report bridge
├── pages/                    auth/ home/ projects/ report/ complaints/ community/
│   │                         alerts/ vision/ assistant/ profile/ + NotFoundPage
├── services/                 api/ auth/ projects/ complaints/ community/ alerts/
│   │                         vision/ reporting/ assistant  (typed, async, mock)
├── types/                    project.ts complaint.ts community.ts alert domain in
│   │                         infrastructure.ts user.ts api.ts report.ts (+index)
├── hooks/                    useAuth useProjects useComplaints useCommunity useAlerts
│   │                         useLocation useInfrastructureVision useAsync useToast useT
├── data/                     projects complaints community alerts infrastructure ward
├── constants/                routes projectStatuses complaintStatuses
│   │                         issueCategories alertSeverities i18n
├── config/                   environment.ts api.ts (+tailwind/postcss at root)
├── utils/                    formatDate formatCurrency validation location download csv
└── main.tsx
```

`tailwind.config.js` and `postcss.config.js` remain JavaScript intentionally — that is the format Tailwind's toolchain consumes. `server.js` is Node tooling. Everything under `src/` is `.ts` / `.tsx` / `.css` only.

---

## Typing highlights

- **Central domain types** (`src/types/`): `Project`, `ProjectStatus` (union), `ProjectFinancials` (amounts are `number` crores), `Contractor`, `ProjectMilestone`, `Complaint` + `ComplaintStatus`/`ComplaintPriority` unions, `CommunityIssue(View)`, `GovernmentAlert(View)`, `VisionAnalysis` (AI observations separated from verified records), `Citizen`, `ApiResponse<T>`/`ApiErrorShape`, typed `ReportDraft`.
- **Strict mode** (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`) — zero errors, no `any`, no `@ts-ignore`.
- **Typed constants**: `ROUTES` + route builders (`projectRoute(id)`…), `PROJECT_STATUS_META`, `COMPLAINT_STATUS_META`, `PRIORITY_META`, `ISSUE_CATEGORIES`, `SEVERITY_META`, i18n dictionaries (EN/हिन्दी/मराठी).
- **Typed services**: every service function has explicit parameter/return types; UI never touches mock arrays directly (`Page → Hook → Service → Data`).
- **Typed hooks**: `useProjects`, `useComplaints`, `useCommunityFeed`, `useAlerts`, `useInfrastructureVision`, `useLocation`, `useAsync<T>`, `useAuth`, `useT`.
- **Typed components**: every component declares a props interface; events use `React.ChangeEvent`/`FormEvent`/`MouseEvent` types; browser APIs (`MediaStream`, `File`, `Blob`, `HTMLVideoElement`) are properly typed and camera streams stop on unmount.

## Design language

Preserved Nirikshan identity per `DESIGN.md`: navy `#0B2342/#102A4C/#17365D`, saffron `#A85B00/#FE932C`, cool-gray canvas `#F5F7FA/#F8FAFC`, status pairs (green/amber/red/blue), Inter + JetBrains Mono, GIGW utility ribbon, compact centered navigation, institutional footer.

## Accessibility & responsible AI

Keyboard navigation, skip link, ARIA landmarks/labels, semantic elements, focus rings, A−/A/A+ scaling, `prefers-reduced-motion`, offline banner, EN/हिन्दी/मराठी. Nirikshan Vision labels AI observations vs verified government records and includes an "About this result" responsibility disclosure on every result.

## Production notes

Services are typed mock implementations (async + simulated latency). Swap their internals for `fetch()` calls against the configured `VITE_API_BASE_URL` without touching components or hooks. No secrets or keys are embedded anywhere.
