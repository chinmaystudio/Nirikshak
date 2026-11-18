# Nirikshak — Proposed 3-Frontend Structure

> This file is a standalone restructuring plan only.
> No changes are made to the existing GitHub repository.

## Goal

Create three independently deployable frontend applications:

1. User Frontend
   - Public landing page
   - Citizen/User portal
2. Government Frontend
   - Government/officer interface
3. Contractor Frontend
   - Contractor portal

No backend or database connection should be added yet.

---

## Current → Proposed Mapping

### 1. User Frontend

Current landing page:

`frontend/Pragati-main`

Move/copy conceptually to:

`frontend/user/landing`

Current citizen/user portal:

`frontend/Constructor frontend`

Move/copy conceptually to:

`frontend/user/portal`

The landing page and citizen portal remain visually unchanged.

Suggested deployment behavior:

- `/` → Pragati landing page
- `/app` → Citizen/User portal

Example:

```text
user.example.com/
user.example.com/app
```

---

### 2. Government Frontend

Current government application:

- `frontend/src`
- `frontend/public`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- associated government frontend configuration files

Proposed location:

`frontend/government`

Example deployment:

```text
government.example.com
```

The existing government UI should remain unchanged.

---

### 3. Contractor Frontend

Current contractor application:

`frontend/zip`

Proposed location:

`frontend/contractor`

Example deployment:

```text
contractor.example.com
```

The existing contractor UI should remain unchanged.

---

# Proposed Repository Structure

```text
Nirikshak/
│
├── frontend/
│   │
│   ├── user/
│   │   │
│   │   ├── landing/
│   │   │   ├── src/
│   │   │   ├── public/
│   │   │   ├── package.json
│   │   │   ├── vite.config.*
│   │   │   └── ...
│   │   │
│   │   └── portal/
│   │       ├── src/
│   │       ├── public/
│   │       ├── package.json
│   │       ├── vite.config.*
│   │       └── ...
│   │
│   ├── government/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── ...
│   │
│   └── contractor/
│       ├── src/
│       ├── public/
│       ├── package.json
│       ├── vite.config.*
│       └── ...
│
└── .gitignore
```

---

# Deployment Architecture

```text
              ┌────────────────────────┐
              │      USER WEBSITE      │
              │                        │
              │  Landing + User Portal │
              └────────────┬───────────┘
                           │
                           │
             FUTURE SHARED BACKEND/API
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
 ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
 │ USER FRONTEND  │ │ GOV FRONTEND   │ │ CONTRACTOR     │
 │                │ │                │ │ FRONTEND       │
 └────────────────┘ └────────────────┘ └────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
                  FUTURE SHARED DATABASE
```

Important:

The browser applications should never directly connect to the database.

Later architecture should be:

```text
Frontend
   ↓
Backend/API
   ↓
Database
```

All three applications can eventually use the same API while having separate authentication and authorization rules.

---

# What Must NOT Change During Frontend Rearrangement

Do not modify:

- Existing UI layouts
- Existing colors
- Typography
- Animations
- Cards
- Charts
- Dashboard designs
- Landing page sections
- Citizen portal pages
- Government portal pages
- Contractor portal pages
- Existing mock data behavior
- Authentication behavior
- Backend logic
- Database logic
- API implementation

Only filesystem/project organization should change.

---

# Recommended Migration Sequence

## Step 1 — Create destinations

Create:

```text
frontend/user/
frontend/user/landing/
frontend/user/portal/
frontend/government/
frontend/contractor/
```

## Step 2 — Landing page

Copy:

```text
frontend/Pragati-main/*
```

to:

```text
frontend/user/landing/
```

Do not modify the UI.

## Step 3 — Citizen/User portal

Copy:

```text
frontend/Constructor frontend/*
```

to:

```text
frontend/user/portal/
```

Do not modify the UI.

## Step 4 — Contractor portal

Copy:

```text
frontend/zip/*
```

to:

```text
frontend/contractor/
```

Do not modify its existing UI.

## Step 5 — Government frontend

Move the existing root-level government application files into:

```text
frontend/government/
```

This includes the government application's:

```text
src/
public/
package.json
package-lock.json
vite.config.*
tsconfig*.json
tailwind.config.*
postcss.config.*
index.html
.env.example
README.md
```

Only files belonging to the government application should move.

Do NOT accidentally move:

```text
Pragati-main/
Constructor frontend/
zip/
```

into the government application.

---

# Independent Deployment Targets

Each frontend should be independently buildable.

## User Landing

Root directory:

```text
frontend/user/landing
```

Typical commands:

```bash
npm install
npm run build
```

## User Portal

Root directory:

```text
frontend/user/portal
```

Typical commands:

```bash
npm install
npm run build
```

## Government

Root directory:

```text
frontend/government
```

Typical commands:

```bash
npm install
npm run build
```

## Contractor

Root directory:

```text
frontend/contractor
```

Typical commands:

```bash
npm install
npm run build
```

---

# Recommended Future Domain Layout

```text
nirikshak.example.com
```

Public/User surface:

```text
nirikshak.example.com
nirikshak.example.com/app
```

Government:

```text
government.nirikshak.example.com
```

Contractor:

```text
contractor.nirikshak.example.com
```

---

# Future Shared Backend

When backend implementation begins later, use a single backend such as:

```text
api.nirikshak.example.com
```

Possible routes:

```text
/api/auth
/api/users
/api/projects
/api/complaints
/api/tenders
/api/contracts
/api/contractors
/api/government
/api/notifications
/api/ai
```

All three frontend deployments can use:

```text
VITE_API_BASE_URL=https://api.nirikshak.example.com
```

But this should NOT be connected during the current frontend-only restructuring stage.

---

# Future Role Separation

Eventually authentication could use roles such as:

```text
citizen
government_officer
administrator
auditor
contractor
```

Example:

```text
Citizen Token
    ↓
User Frontend

Government Officer Token
    ↓
Government Frontend

Contractor Token
    ↓
Contractor Frontend
```

The backend should enforce access control, not only the frontend.

---

# Current Scope

Current work should be limited to:

- filesystem organization
- independent frontend boundaries
- deployment-ready directory separation
- preserving all existing UI

Do NOT implement yet:

- backend
- database
- authentication redesign
- shared API
- production RBAC
- shared state between applications
- API gateway
- database schema
- WebSockets
- production AI integrations

Those can be handled separately when explicitly requested.
