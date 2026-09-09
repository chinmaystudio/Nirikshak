# NIRIKSHAK — Frontend

**Government Project Monitoring & Accountability Platform**
*Transparent Projects • Stronger India*

NIRIKSHAK is a production-structured React frontend for monitoring public
infrastructure projects — the officer console (dashboard, projects, finance,
tenders, approvals, audit, AI-assisted insights) and a public citizen
transparency portal — refactored from the original Stitch design
("Nirikshan Civic Infrastructure") into a fully organized, typed,
token-driven application.

> ⚠️ **Demonstration build.** Every record shown is mock data. NIRIKSHAK is
> **not** connected to any government backend, and **no real government
> authentication (NIC / Parichay / SSO) is integrated** — the sign-in flow is
> illustrative only.

---

## Tech Stack

| Concern    | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | React 18 + TypeScript 5.6 (strict)                 |
| Build      | Vite 5                                             |
| Routing    | React Router 6.28                                  |
| Styling    | Tailwind CSS 3.4 over CSS-variable design tokens   |
| Charts     | Hand-rolled SVG/CSS (no chart library)             |
| Fonts      | Noto Sans (+ Noto Sans Devanagari), Material Symbols |

## Getting Started

```bash
cd frontend
npm install        # install dependencies
npm run dev        # dev server (Vite, http://localhost:5173)
npm run build      # type-check (tsc) + production build → dist/
npm run preview    # serve the production build locally
npm run typecheck  # tsc --noEmit only
```

### Environment variables

Copy `.env.example` → `.env.local`:

| Variable               | Default  | Purpose                                              |
| ---------------------- | -------- | ---------------------------------------------------- |
| `VITE_USE_MOCK_API`    | `true`   | When `true`, pages use `src/api/mockApi.ts`          |
| `VITE_DEFAULT_LOCALE`  | `en`     | Initial UI language: `en`, `hi`, or `mr`             |

## Project Structure

```
frontend/
├── index.html                  # pre-paint theme/a11y script, fonts, favicon
├── package.json                # scripts + pinned dependencies
├── vite.config.ts              # @/* path alias → src
├── tailwind.config.js          # every utility mapped to a CSS variable token
├── postcss.config.js
├── tsconfig.json               # strict TypeScript
├── .env.example                # documented env vars
├── scripts/process-logo.mjs    # sharp-based logo variant generator (one-time)
├── public/
│   └── logo/                   # provided logo variants (full, icon, dark-canvas)
└── src/
    ├── main.tsx                # entry: StrictMode + BrowserRouter
    ├── App.tsx                 # provider tree
    ├── routes/index.tsx        # full route map (auth / government / citizen)
    ├── api/                    # API layer (mock today, REST-shaped for swap-in)
    │   ├── index.ts            #   public surface — pages import from here
    │   └── mockApi.ts          #   async implementations over demo data
    ├── components/
    │   ├── ui/                 # Button, Badge, Fields, Card/Panel, StatusBadge,
    │   │                       # Progress, Logo
    │   ├── layout/             # header, sidebar, footer, notification drawer
    │   ├── navigation/         # Tabs, Dropdown, Breadcrumbs
    │   ├── charts/             # KpiCard, BarChart, SegmentBar, Sparkline, Donut
    │   ├── tables/             # generic DataTable
    │   ├── modals/             # Modal (focus trap), Drawer
    │   ├── feedback/           # EmptyState, Skeleton, LoadingBlock
    │   └── accessibility/      # AccessibilityMenu (size/contrast/theme/motion)
    ├── context/                # Theme, Accessibility, I18n, Auth, Toast, Notifications
    ├── hooks/useApiData.ts     # useApiData + useDebounced
    ├── layouts/                # GovernmentLayout, CitizenLayout, AuthLayout
    ├── pages/                  # one folder per module (see route map below)
    ├── constants/              # departments, districts, categories, nav config
    ├── data/                   # demo records (projects, tenders, grievances, …)
    ├── types/index.ts          # shared domain vocabulary
    ├── locales/                # en / hi / mr dictionaries (3 languages)
    ├── utils/                  # format (₹ Cr/Lakh, dates, masking), status
    │                           # descriptors, focus rings, class joiner
    └── styles/
        ├── tokens.css          # design tokens — single source of truth
        ├── themes.css          # light/dark themes (dark = deep grey, never black)
        ├── accessibility.css   # text-size, high-contrast, reduced-motion
        └── globals.css         # base + Stitch-preserved utility classes
```

## Route Map

| Area        | Routes                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| Auth        | `/login`, `/otp-verification`, `/forgot-password`, `/reset-password`, `/2fa`, `/select-department`, `/select-role` |
| Government  | `/dashboard`, `/projects`, `/projects/create`, `/projects/:id` (13 sub-tabs), `/planning`, `/finance`, `/tenders`, `/tenders/:id`, `/contractors`, `/work-orders`, `/milestones`, `/approvals`, `/grievances`, `/litigation`, `/documents`, `/alerts`, `/audit`, `/ai-insights`, `/reports`, `/settings` |
| Citizen     | `/citizen`, `/citizen/projects`, `/citizen/projects/:id`, `/citizen/nearby`, `/citizen/grievance`, `/citizen/track` |
| Errors      | `*` → 404, `/error` → 500                                                                                     |

## Mock API & Connecting a Real Backend

All data access goes through the async functions in `src/api/`
(`projectsApi.list`, `approvalsApi.all`, `grievancesApi.submitGrievance`, …).
They return the same shapes a REST backend would — `Promise<Paginated<T>>`
envelopes with `page`, `pageSize`, `total` — with simulated latency so loading
states are real.

To connect a backend:

1. Set `VITE_USE_MOCK_API=false` (the flag exists in `constants`).
2. Replace the bodies in `src/api/mockApi.ts` (or add `src/api/restApi.ts`)
   with real `fetch`/axios calls — **keep the same exported names and return
   types**, since pages import from `src/api/index.ts` only.
3. No page or component changes are required; that is the point of the layer.

All screens label their figures as demo data (banner + per-page notes). Demo
session state lives in `localStorage` under `nirikshak.*` keys (`session`,
`theme`, `contrast`, `textSize`, `reducedMotion`, `locale`).

## Accessibility

- Status is **never color alone** — every status renders icon + translated
  text + tone tint (`utils/status.ts` descriptors).
- Keyboard support throughout: skip link, focus-visible rings, roving-tabindex
  tabs, focus-trapped modals, Escape/arrow handling.
- Accessibility menu (header): text size, high contrast, light/dark/system
  theme, reduced motion, language.
- Light + dark themes from CSS-variable tokens; dark mode is deep grey, never
  pure black; `html[lang='hi'|'mr']` raises line-height for Devanagari.
- Reduced-motion media/query class disables animations.

## AI Governance

AI assists, it never decides. Every AI surface carries:

- the classification chip (AI-Generated Insight / Verified Data / Officer
  Decision), confidence band, supporting data and recommended action;
- per-factor **"Why this score?"** evidence in contractor evaluation;
- the verbatim disclaimers — *"AI-assisted evaluation. Final decision remains
  with the authorized officer."* and *"AI-assisted analysis. Review required
  by authorized officer."*
