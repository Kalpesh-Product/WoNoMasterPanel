# WoNo Master Panel

Developer documentation for the **WONO Master Panel** — the internal staff console that runs the WONO business: companies and host companies, listings, verification and plan payments, host websites, the Nomads content pipeline, analytics and office operations.

Two apps in one repository:

| Folder | App | Default URL |
| ------ | --- | ----------- |
| `client/` | React 19 + Vite admin console | `http://localhost:3007` |
| `server/` | Express + MongoDB API | `http://localhost:5007` |

The Master Panel is the source of truth for plan pricing, host onboarding state, verification requests and website templates. Nomads and the Host Panel read that data through dedicated public and service-key endpoints documented below.

> Looking for the Nomads developer guide? See the [Nomads repository](https://github.com/Kalpesh-Product/Nomads).

## Table of contents

- [What the panel covers](#what-the-panel-covers)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [Server architecture](#server-architecture)
- [Authentication and access control](#authentication-and-access-control)
- [API surface](#api-surface)
- [Client structure](#client-structure)
- [Host websites and the website builder](#host-websites-and-the-website-builder)
- [Cross-application integrations](#cross-application-integrations)
- [Scheduled jobs](#scheduled-jobs)
- [Data models](#data-models)
- [Tests and checks](#tests-and-checks)
- [Deployment](#deployment)
- [Working in this repository](#working-in-this-repository)
- [Troubleshooting](#troubleshooting)

## What the panel covers

- **Company and listing operations** — company records, host companies, products, logos and images, bulk uploads from the data team, publishing and activation state, POC and review moderation.
- **Leads and verification** — company signup leads, verification leads with Stripe-hosted payment, value-adds partners, contributor leads, job applications, Nomad signup leads.
- **Host Panel administration** — host companies, support tickets, website credits and templates, plan pricing, host module content.
- **Plan and billing** — Professional/Basic plan pricing, upgrade requests, trial periods, invoices, expiry reminders and automatic downgrade.
- **Host websites** — theme catalogue, template provisioning, GrapesJS editing, public previews and theme/destination catalogues.
- **Content pipeline** — blog, news, event, place and restaurant submissions reviewed here and published into Nomads via its admin API.
- **Analytics** — Master Panel activity, Host Panel analytics, Nomad click analytics, destination analytics and GA4-backed site analytics.
- **Office modules** — HR (attendance, leaves, payslips, payslips/payroll, agreements, handbook), tickets, tasks, meetings, assets, visitors, vendors, inventory, budget, finance, sales, performance and administration.

## Repository layout

```text
WoNoMasterPanel/
  client/                     React 19 + Vite admin console
    src/
      pages/                  Feature screens (Dashboard, HR, Tickets, Tasks, Assets, Visitors, Meetings, Performance, Access, Profile)
      components/             Shared UI, tables, charts, MUI wrappers, Sidebar, Permissions
      layouts/                MainLayout, AuthLayout, PersistLogin
      routes/Routes.jsx       Single React Router tree (~280 route entries)
      redux/                  Store + slices (session-persisted, encrypted)
      context/                AuthContext, SideBarContext
      hooks/, utils/          Data hooks and the axios instances
      tours/                  Driver.js onboarding tours
    vite.config.js            Dev server on port 3007
  server/                     Express API (CommonJS)
    server.js                 Entrypoint: middleware order, all route mounts, jobs, listen
    routes/                   Route modules per domain
    controllers/              Request handlers and business logic
    models/                   Mongoose schemas
    config/                   db, CORS, multer, S3, Cloudinary, mailer, module + permission catalogues
    middlewares/              verifyJwt, verifyJwtOptional, auditLogger, requireModuleAccess, requireSuperAdmin, checkPermission, service-key guards
    jobs/                     node-schedule background jobs
    listeners/                Log event listener
    services/                 Pricing helpers
    tests/                    node:test suites
    views/, public/           API home and 404 pages
  .github/workflows/deploy.yml   EC2 deployment workflow
```

The `templates/` folder at the repository root is currently empty. `server/credentials/` holds the GA4 service-account key and is gitignored — never commit it.

## Tech stack

**Client**

| Technology | Use |
| ---------- | --- |
| React 19 + Vite 6 | Application and build tooling |
| React Router 7 (`createBrowserRouter`) | Routing |
| Redux Toolkit + Redux Persist (sessionStorage, encrypted) | Client state |
| TanStack React Query | Server-state fetching |
| MUI 7 (Material + Joy), styled-components, Tailwind CSS 3 | UI and layout |
| AG Grid | Large data tables |
| FullCalendar, ApexCharts, MUI X Charts | Calendars and dashboards |
| GrapesJS | Website template editor |
| Axios | HTTP client |
| docx-preview, jsPDF, html2pdf.js, html2canvas | Generated documents and exports |
| Driver.js, Sonner | Tours and notifications |

**Server**

| Technology | Use |
| ---------- | --- |
| Node.js (CommonJS) | Runtime |
| Express 4 | HTTP framework |
| MongoDB + Mongoose 8 | Persistence |
| JWT (`jsonwebtoken`) + bcryptjs | Auth and password hashing |
| Multer + Sharp | Uploads and image processing |
| AWS S3, Cloudinary | Object and image storage |
| Nodemailer | Transactional email |
| Stripe | Hosted payment links and webhooks |
| node-schedule | Scheduled jobs |
| ExcelJS, csv-parser | Bulk import/export |
| pdf-lib | PDF generation |
| `@google-analytics/data` | GA4 reporting |

`socket.io` and `ioredis` are declared in `server/package.json` but are not initialized anywhere in the server code today; treat them as available, not active.

## Prerequisites

- Node.js 20 or newer
- npm
- MongoDB connection string
- Stripe test keys if you exercise payment flows
- AWS S3 and/or Cloudinary credentials for upload flows
- The Nomads API running locally if you need contributor leads, verification or listing sync
- The Host Panel API running locally if you need host-side screens

## Getting started

Install both apps separately (there is no root `package.json`):

```bash
cd server
npm install

cd ../client
npm install
```

Create `server/.env` and `client/.env`, then run both in separate terminals:

```bash
# Terminal 1 — API on http://localhost:5007
cd server
npm run dev

# Terminal 2 — admin console on http://localhost:3007
cd client
npm run dev
```

The server starts listening only after Mongoose connects (`mongoose.connection.once("open")`), so an API that never answers is usually a bad `DB_URL`.

The Vite dev server runs on **3007** with `--host`, matching the allowed origins in `server/config/corsConfig.js`. `npm run build` in `client/` needs a larger heap (the script sets `--max-old-space-size=8192` through `cross-env`).

## Environment variables

Never commit real values.

**Server (`server/.env`)**

```env
PORT=5007
DB_URL=

ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
PASSWORD_RESET_OTP_SECRET=

EMAIL_USER=
EMAIL_PASS=

CORS_FRONTEND_URL=
NODE_ENV=development
FORCE_GOOGLE_DNS=false

# Nomads integration
NOMADS_BASE_URL=http://localhost:3000/api
NOMADS_FRONTEND_BASE_URL=http://localhost:5173
NOMADS_ADMIN_API_KEY=
NOMADS_SERVICE_API_KEY=

# Host Panel integration
HOST_PANEL_FRONTEND_URL=
HOST_PANEL_FRONTEND_URL_LOCAL=http://host.localhost:5174
HOST_PANEL_FRONTEND_URL_DEV=
HOST_PANEL_RETURN_BASE_URL=
HOSTPANEL_SERVICE_API_KEY=
HOST_INVITE_TOKEN_SECRET=
HOST_INVITE_TOKEN_EXPIRY=
STAFF_VIEW_TOKEN_SECRET=
STAFF_VIEW_TOKEN_EXPIRY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Storage
PROJECT_AWS_REGION=
PROJECT_AWS_ACCESS_KEY=
PROJECT_AWS_SECRET_KEY=
PROJECT_S3_BUCKET_NAME=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Analytics
GA4_SERVICE_ACCOUNT_KEY_PATH=
GA4_PROPERTY_ID=
```

`NOMADS_ADMIN_API_KEY` must match `ADMIN_API_KEY` in the Nomads backend; `NOMADS_SERVICE_API_KEY` and `HOSTPANEL_SERVICE_API_KEY` must match the corresponding values in those services.

**Client (`client/.env`)**

```env
VITE_PROD_LINK=
VITE_DEV_LINK=http://localhost:5007
VITE_NOMADS_BACKEND_URL=http://localhost:3000/api
VITE_NOMADS_SITE_URL=http://localhost:5173
VITE_REDUX_PERSIST=
VITE_VALUE_ADDS_API_BASE_URL=
VITE_HOST_PANEL_URL=
```

`client/src/utils/axios.js` picks the base URL from the Vite mode: `production` uses `VITE_PROD_LINK`, development uses `VITE_DEV_LINK`. Both instances are exported — `api` for public calls and `axiosPrivate` (`withCredentials: true`) for authenticated calls that need the refresh cookie. `VITE_REDUX_PERSIST` is the encryption key for the persisted Redux store; changing it invalidates every staff member's saved session state. Because the deploy workflow writes `VITE_PROD_LINK` empty, production requests are relative to the client origin when the API is reverse-proxied alongside it.

## npm scripts

**Server**

| Script | Command | Notes |
| ------ | ------- | ----- |
| `npm run dev` | `nodemon server.js` | Local development |
| `npm start` | `node server.js` | Production entrypoint |
| `npm test` | placeholder | Exits with an error; run the suites in `server/tests` directly |
| `npm run structure` | `node generateStructure.js > structure.txt` | Regenerate the folder map |

**Client**

| Script | Command |
| ------ | ------- |
| `npm run dev` | `vite --host` (port 3007) |
| `npm run build` | Production build with an 8 GB heap |
| `npm run preview` | Preview the build |
| `npm run lint` | ESLint |
| `npm run structure` | Regenerate `structure.txt` |

## Server architecture

`server/server.js` assembles the app in a deliberate order; keep it that way when adding middleware:

1. `dotenv` (with optional Google DNS override), `credentials`, `cors`, `cookie-parser`.
2. The Stripe webhook at `POST /api/host-user/stripe-webhook` is registered **before** `express.json()` because it needs the raw body to verify the signature.
3. `express.json({ limit: "10mb" })`, `express.urlencoded`, static `public/`.
4. Public endpoints (`/api/public/*`, `/api/editor/get-website/:companyName`, `/api/recruitment`, `/api/hosts` with optional auth).
5. Authenticated route groups, most wrapped as `verifyJwt, auditLogger, routes`.
6. Service-to-service groups (`/api/internal/verification-payments`, `/api/hostpanel`) that authenticate with a shared key inside their own routers.
7. 404 handler (HTML/JSON/text), then the Multer/body-size handler, then `errorHandler`.
8. `mongoose.connection.once("open")` starts the listener on `PORT` (5007 by default).

**Audit logging** — `auditLogger` records mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`) for authenticated staff, skipping token refresh. Each router tags its activity with `setLogModule("...")` from `middlewares/logContext.js`, so the Logs screens can group entries by module. Entries leave through `utils/eventEmitter` and are written by `listeners/logEventListener.js`.

## Authentication and access control

- `POST /api/auth/login` returns a JWT access token and sets the refresh cookie; `GET /api/auth/refresh` rotates it; `GET /api/auth/logout` clears it. Password reset is OTP-based (`/api/auth/forgot-password/start`, `/verify-otp`, `/reset`).
- `verifyJwt` reads `Authorization: Bearer <token>`, verifies with `ACCESS_TOKEN_SECRET` and attaches `req.user`, `req.roles`, `req.company`, `req.departments`, `req.creditsBalance` and the full `req.userData` (which carries `isSuperAdmin` and `allowedModules`).
- `verifyJwtOptional` lets public-shared routes (for example `/api/hosts` and `/api/recruitment`) accept anonymous traffic while still attributing logged-in actions.
- The client's `PersistLogin` layout calls the refresh endpoint on load, so a staff member with a valid refresh cookie lands straight on the dashboard.

There are three layers of authorisation, used for different domains:

| Guard | Scope | Catalog |
| ----- | ----- | ------- |
| `requireSuperAdmin` | Panel administration (users, module grants) | — |
| `requireModuleAccess("key")` | Master Panel sidebar modules | `server/config/masterPanelModules.js`, mirrored by keys in `client/src/components/Sidebar.jsx` |
| `checkPermission(permissions, role)` | HR/office modules with role-based permissions | `models/Permissions.js`, `models/roles` |

Module keys are grouped as `dashboard.*` and `hostpanel.*`. **Keep the key strings in the server catalogue and the sidebar in sync** — a mismatch silently hides a screen a staff member was granted.

## API surface

| Prefix | Auth | Purpose |
| ------ | ---- | ------- |
| `/api/auth` | Public | Login, refresh, logout, signup, OTP password reset |
| `/api/public/plan-pricing`, `/api/public/plan-payment-status`, `/api/public/website-themes` | Public | Pricing, payment polling and theme catalogue for Nomads/Host Panel |
| `/api/editor/get-website/:companyName` | Public | Rendered website template |
| `/api/recruitment` | Optional | Careers jobs and applications |
| `/api/hosts` | Optional | Shared host-company read/write endpoints |
| `/api/host-user` | Mixed | Host users, invites and the Stripe webhook |
| `/api/internal/verification-payments` | Nomads service key | Verification payment link creation and lead history |
| `/api/hostpanel` | Host Panel service key | Verification requests, badge visibility, plan invoices, company claim search |
| `/api/admin`, `/api/admin-access` | JWT | Admin users, module grants (superadmin checks inside the router) |
| `/api/nomad-users` | JWT | Nomad signup leads, destination analytics, session logs, exports |
| `/api/contributor-leads` | JWT | Proxy to Nomads' contributor endpoints with the admin API key |
| `/api/company-verification-leads`, `/api/company`, `/api/blogs`, `/api/news`, `/api/places`, `/api/destination-content`, `/api/host-modules` | JWT | Content, companies and listing operations |
| `/api/employee`, `/api/users`, `/api/roles`, `/api/departments`, `/api/designations`, `/api/attendance`, `/api/leaves`, `/api/payroll`, `/api/payslip`, `/api/performance`, `/api/agreement`, `/api/employee-agreements` | JWT | HR |
| `/api/tickets`, `/api/tasks`, `/api/meetings`, `/api/assets`, `/api/inventory`, `/api/visitors`, `/api/budget`, `/api/finance`, `/api/sales`, `/api/vendors`, `/api/amc`, `/api/tech`, `/api/administration`, `/api/weekly-unit` | JWT | Operations modules |
| `/api/website-credits`, `/api/website-template-changes`, `/api/website-theme-catalog`, `/api/subscription` | Mixed | Host website provisioning and plans |
| `/api/site-analytics`, `/api/logs`, `/api/notifications`, `/api/access` | JWT | Analytics, audit logs, notifications, access logs |

Unknown paths return `404` as HTML, JSON or plain text based on the `Accept` header. Oversized uploads and bodies return `413` with a staff-readable message.

## Client structure

- `client/src/routes/Routes.jsx` is one `createBrowserRouter` tree with roughly 280 entries: `/` (login), forgot-password steps, `/website-preview`, `/website-preview/demo/:templateId`, then a `MainLayout` group covering `dashboard/*`, `hostpanel/*`-style dashboard screens, HR, tickets, tasks, assets, visitors, meetings, performance, access and profile pages. `AuthLayout` guards the signed-in area.
- Screens live in `client/src/pages/<Feature>/` and usually follow the pattern `Dashboard`, `Manage*`, `Reports`, `Settings` so the sidebar and sub-navigation stay predictable.
- Shared building blocks — `AgTable`, `MuiModal`, `PrimaryButton`, `StatusChip`, `BreadCrumbComponent`, `PermissionsTable`, `Sidebar` — live in `client/src/components/`.
- Redux slices are grouped per feature (`clientSlice`, `ticketSlice`, `meetingSlice`, `salesSlice`, `hrSlice`, `performanceSlice`, `financeSlice`, `userSlice`, `assetsSlice`, `companySlice`); persistence uses sessionStorage with `redux-persist-transform-encrypt`.
- Driver.js tours are defined in `client/src/tours/` and attached to first-visit screens.

## Host websites and the website builder

The panel provisions and edits the websites hosts get with their plans:

- Theme and vertical catalogues come from `server/config/themeTokens.js`, `server/config/verticalConfig.js` and `server/config/hostWorkspaceModuleCatalog.js`.
- `client/src/pages/Dashboard/FrontendDashboard/WebsiteBuilder/` contains the theme grid, template viewer, GrapesJS editor and preview routes.
- Public previews are served at `/website-preview` and `/website-preview/demo/:templateId`; Nomads links to these instead of sending users to production.
- Rendering for live sites is fetched from `/api/editor/get-website/:companyName`, and themes are published through `/api/public/website-themes` for Nomads' template pickers.
- Credits, template changes and module pricing (`services/modulePricingService.js`) gate how often a host can switch templates or modules.

## Cross-application integrations

**Nomads** (`NOMADS_BASE_URL`, `NOMADS_ADMIN_API_KEY`)

- Contributor leads proxy: `GET /api/contributor-leads`, `PATCH /api/contributor-leads/:id/status` → Nomads `/api/become-contributor`.
- Blog/news, place, event and restaurant review actions call Nomads' admin endpoints so the public site reflects moderation immediately.
- Nomads calls *in* at `/api/internal/verification-payments` (guarded by `verifyNomadsServiceKey`) to create verification payment links and read lead history.
- Nomad user leads and analytics come from Nomads' `/api/admin/nomad-users`.

**Host Panel** (`HOST_PANEL_*`, `HOSTPANEL_SERVICE_API_KEY`)

- `/api/hostpanel/*` lets the Host Panel submit and pay verification requests, toggle badge visibility and read plan invoices without a staff session.
- Host invites and staff-view links are signed with `HOST_INVITE_TOKEN_SECRET` / `STAFF_VIEW_TOKEN_SECRET` and their expiry values.

**Stripe** — `STRIPE_SECRET_KEY` creates hosted payment links for verification, plans and upgrades; `POST /api/host-user/stripe-webhook` verifies the signature with `STRIPE_WEBHOOK_SECRET` and is idempotent. Payment state is mirrored onto `PlanPaymentLink`, `VerificationPaymentLink` and `BookingPaymentLink`.

**Email** — Nodemailer via `config/nodemailerConfig.js`, sharing the WONO email shell used across the products. Failures are reported to staff instead of silently blocking an approval.

**Uploads** — `multerConfig.js` → S3 (`s3config.js`) or Cloudinary, with Sharp resizing for logos and images.

## Scheduled jobs

`server/server.js` registers these jobs from `server/jobs/`:

| Job | Purpose |
| --- | ------- |
| `planExpiryReminders` | Notify hosts before a plan expires |
| `planExpiryDowngrade` | Downgrade or deactivate plans after expiry |
| `verificationExpiryNotices` | Warn about expiring company verification |
| `verificationRenewalReminders` | Nudge hosts to renew verification |
| `verificationTrialEndingNotices` | Warn before a verification trial ends |

They run in-process with `node-schedule`, so a single running server should own them; extra instances would duplicate reminders unless the job itself is idempotent.

## Data models

Top-level models in `server/models/` cover access and administration (`AdminUser`, `AccessLog`, `ModuleAccessLog`, `Log`, `Modules`, `Permissions`, `Notification`, `Otp`) and payments/verification (`PlanPaymentLink`, `VerificationPaymentLink`). Feature domains are nested folders: `hostCompany/`, `website/`, `recruitment/`, `hr/`, `payrolls/`, `tasks/`, `tickets/`, `meetings/`, `assets/`, `budget/`, `finance/`, `inventory/`, `sales/`, `visitor/`, `roles/`, `locations/`, `events/`, `administration/`, plus `WonoDestinationListing` and `WonoDestinationRanking` for Nomads destination data.

Mongoose schemas are the only migration mechanism — changes are applied by the models on the next boot.

## Tests and checks

- `client`: `npm run lint` and `npm run build` before shipping.
- `server`: `npm test` is a placeholder. Suites live in `server/tests/` and use Node's built-in runner, for example:

  ```bash
  cd server
  node --test tests/blogContributionReviewer.test.js
  ```

- For changes without a focused suite, exercise the affected screen against a local API; the panel has no end-to-end harness.

## Deployment

`.github/workflows/deploy.yml` runs manually (`workflow_dispatch`):

1. Writes `client/.env` from the secrets `VITE_DEV_LINK`, `VITE_NOMADS_BACKEND_URL` and `VITE_REDUX_PERSIST`.
2. `npm ci && npm run build` in `client/`.
3. rsyncs `client/dist/` to `/home/ubuntu/apps/WoNoMasterPanel/client/dist/`.
4. On the server: `git pull origin main`, `npm install` in `server/` when `server/package.json` changed, then `pm2 restart masterpanel`.

Required repository secrets: `VITE_DEV_LINK`, `VITE_NOMADS_BACKEND_URL`, `VITE_REDUX_PERSIST`, `EC2_SSH_KEY`, `EC2_HOST`, `EC2_USER`.

Both apps also carry `vercel.json` files that deploy the `main` branch only. The API's server-side environment (Stripe, S3, service keys) must be configured wherever it is hosted; it is not part of the frontend bundle.

## Working in this repository

1. Pull `development` (or your feature branch) and install dependencies in the app you are touching.
2. Keep `server/config/masterPanelModules.js` and `client/src/components/Sidebar.jsx` keys aligned when adding a module.
3. Tag new routers with `setLogModule("...")` so audit logs stay readable.
4. Never expose staff data through a public route; public endpoints are limited to pricing, themes, website rendering, careers and the shared `/api/hosts` surface.
5. Run `npm run lint` and `npm run build` in `client/` before opening a pull request.
6. Never commit `server/credentials/`, `.env` files, uploads or build output.

**Conventions**

- Client code is ESM with JSX; server code is CommonJS (`require`/`module.exports`) — do not mix module systems in either app.
- Server domains follow route → controller → model, with shared behaviour in `middlewares/`, `services/` or `utils/`.
- Screens follow the `Dashboard` / `Manage*` / `Reports` / `Settings` sub-page pattern inside a layout component.
- Export-heavy screens use AG Grid + ExcelJS rather than ad-hoc CSV building.

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| API never starts listening | `DB_URL` missing or unreachable |
| `Not allowed by CORS: <origin>` | Origin missing from `server/config/corsConfig.js` (allowed: `localhost:3007`, `*.localhost:5173/5174`, `*.wono.co`, quick tunnels) |
| Login succeeds but the console bounces to `/` | Refresh cookie blocked — check `withCredentials`, the CORS `credentials: true` setting, and the cookie's `SameSite`/domain |
| 403 "You don't have access to this module" | `allowedModules` on the admin user does not include the module key, and the user is not a superadmin |
| Contributor leads fail | Nomads API down, or `NOMADS_ADMIN_API_KEY` does not match Nomads' `ADMIN_API_KEY` |
| Verification payments fail | Stripe test keys missing, or `STRIPE_WEBHOOK_SECRET` does not match the endpoint's signing secret |
| Uploads fail | S3 or Cloudinary credentials, bucket or region wrong |
| Host Panel screens return 401/403 | `HOSTPANEL_SERVICE_API_KEY` mismatch, or an expired invite/staff-view token |
| `npm run build` dies with a heap error | Build without the provided script (the script raises the heap to 8 GB) |
| Analytics empty | `GA4_SERVICE_ACCOUNT_KEY_PATH` file missing from `server/credentials/` or `GA4_PROPERTY_ID` wrong |
