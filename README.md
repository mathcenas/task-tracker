# TaskTracker Pro — Technical Reference

> **by Cenas-Support** — Internal IT service management platform with client reporting, recurring tasks, quotes, and uptime monitoring.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Running Locally](#running-locally)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [NPM Scripts](#npm-scripts)
- [Key Features & Implementation Notes](#key-features--implementation-notes)
- [Database Maintenance](#database-maintenance)

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│           Browser (SPA)             │
│  React 18 + TypeScript + Vite       │
│  Tailwind CSS + Lucide Icons        │
└──────────────┬──────────────────────┘
               │ HTTP / REST
┌──────────────▼──────────────────────┐
│       Node.js / Express Server      │
│  JWT Auth · REST API · SQLite ORM   │
│  Socket.io-client (Uptime Kuma)     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│           SQLite Database           │
│       /app/data/tasktracker.db      │
│     (Docker volume persisted)       │
└─────────────────────────────────────┘
```

The app is a **monolith**: the same Node.js process serves the static SPA build **and** the REST API. In Docker, port 3000 is exposed. In local dev, Vite runs on a separate port and proxies `/api` to port 3001.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Routing | React Router v6 |
| Date handling | date-fns 3 |
| PDF export | jsPDF + jspdf-autotable |
| Real-time (Uptime Kuma) | socket.io-client |
| Backend | Node.js + Express 4 |
| Database | SQLite 3 (sqlite3 package) |
| Password hashing | bcryptjs |
| Deployment | Docker + Docker Compose |
| Process management | Shell script + dcron (cron inside container) |

---

## Project Structure

```
/
├── src/
│   ├── App.tsx                    # Router config, route definitions
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # Tailwind base + custom component classes
│   ├── types.ts                   # Shared TypeScript interfaces
│   ├── auth/
│   │   ├── authConfig.ts          # Auth constants (session TTL, lockout, etc.)
│   │   ├── authService.ts         # Client-side session management
│   │   └── database.ts            # Static fallback user store (legacy)
│   ├── context/
│   │   └── AppContext.tsx         # Global state: clients, projects, tasks
│   ├── hooks/
│   │   └── useDarkMode.ts         # Dark mode persistence hook
│   ├── services/
│   │   └── api.ts                 # ApiService class — all HTTP calls to /api
│   ├── components/
│   │   ├── Layout.tsx             # App shell: sidebar, header, search
│   │   ├── WorkQueue.tsx          # Default home view — active task list
│   │   ├── WeeklyDashboard.tsx    # Current week overview
│   │   ├── ForthnightDashboard.tsx# Last 15 days
│   │   ├── MonthlyDashboard.tsx   # Monthly view + multi-month PDF export
│   │   ├── OverviewDashboard.tsx  # 3/6-month KPI aggregates
│   │   ├── ClientDashboard.tsx    # Per-client breakdown + PDF/CSV export
│   │   ├── ProjectsDashboard.tsx  # Kanban-style project explorer
│   │   ├── AllTasksPage.tsx       # Full task list + bulk operations
│   │   ├── KanbanBoard.tsx        # Drag-and-drop status board
│   │   ├── IdeasBoard.tsx         # Overdue / in-progress idea cards
│   │   ├── SuppliesPage.tsx       # Insumos tracker with analytics
│   │   ├── SuppliesPaymentTracker.tsx # Billed/paid status tracker
│   │   ├── RecurringTasksPage.tsx # Manage recurring task definitions
│   │   ├── RecurringTaskManager.tsx   # Modal version (auto-generates tasks)
│   │   ├── ReportsPage.tsx        # Unified report builder (PDF + Markdown)
│   │   ├── QuotesList/Form/View   # Quote management (standard + BOM)
│   │   ├── PublicMonthlyReport.tsx# Public client-facing report page
│   │   ├── PublicStatusPage.tsx   # Public uptime status page
│   │   ├── ActivityLog.tsx        # Audit trail
│   │   ├── CompanySettings.tsx    # Logo, address, tax ID for PDF headers
│   │   ├── MonitorIntegration.tsx # JSON feed monitor connections
│   │   ├── StatusPageSettings.tsx # Public status page management
│   │   ├── BulkTaskOperations.tsx # Multi-task edit/complete/delete modal
│   │   ├── MarkdownImportModal.tsx# Import edited markdown reports back
│   │   ├── CSVImport.tsx          # Kimai-format CSV importer
│   │   ├── JSONImport.tsx         # Full backup JSON importer
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── UserProfile.tsx
│   │   └── ui/
│   │       ├── Card.tsx
│   │       ├── TaskFilters.tsx
│   │       ├── TaskStatusBadge.tsx  (also TaskStatus.tsx)
│   │       └── ThemeToggle.tsx
│   └── utils/
│       ├── csvExport.ts           # Export tasks to CSV
│       ├── csvImport.ts           # Parse Kimai CSV format
│       ├── markdownExport.ts      # AI-ready markdown reports w/ dup detection
│       ├── markdownImport.ts      # Diff + apply edited markdown back to DB
│       ├── multiMonthPdfExport.ts # Multi-month consolidated PDF
│       ├── pdfExport.ts           # PDFExporter class (jsPDF wrapper)
│       ├── projectIdeasPdfExport.ts # Project summary PDF
│       ├── sampleData.ts          # Demo data generator
│       ├── slugify.ts             # Client slug generator
│       └── taskFilters.ts         # Filter helpers (recurring reminders, etc.)
│
├── server/
│   ├── index.js                   # Main Express server (2100+ lines)
│   ├── init-db.js                 # DB schema + seed (used by Docker entrypoint)
│   ├── migrate.js                 # Incremental migration runner
│   ├── migrate-yearly-rates.js    # One-off migration for client yearly rates
│   ├── uptime-kuma-service.js     # Socket.io client for Uptime Kuma
│   ├── backup-cron.js             # Daily JSON backup (runs via cron)
│   ├── start-with-cron.sh         # Docker entrypoint: init → migrate → cron → server
│   ├── verify-db.js               # DB health check utility
│   ├── verify-task-status.js      # Consistency check: finished vs status
│   ├── fix-completed-tasks.js     # Repair inconsistent task states
│   ├── clean-orphaned-tasks.js    # Remove tasks with empty client/project IDs
│   ├── remove-duplicates.js       # Interactive duplicate task cleaner
│   ├── set-recurring-due-today.js # Dev helper: force recurring tasks due today
│   ├── check-status-pages.js      # Verify/create status_pages table
│   ├── clean-activity-log.js      # Trim activity log to last 1000 entries
│   └── backups/                   # Auto-generated daily JSON backups
│
├── public/
│   └── logo - Copy.png
│
├── Dockerfile                     # Multi-stage: builder (Node 20) → runner (Alpine)
├── docker-compose.yml
├── docker-deploy.sh               # Interactive deploy script
├── docker-fix-db.sh               # Fix payment columns in running container
├── docker-migrate-db-location.sh  # One-off: move DB from /app/server to /app/data
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.app.json
└── package.json
```

---

## Database Schema

All tables live in a single SQLite file. The server auto-creates tables on startup via `initDB()`.

| Table | Purpose |
|-------|---------|
| `users` | Auth: username, bcrypt hash, role (admin/user), lockout |
| `clients` | Client records with hourly rate and slug |
| `client_yearly_rates` | Per-year hourly rate overrides for accurate historical billing |
| `projects` | Projects belong to clients; status: active/completed/on-hold |
| `tasks` | Core work items. Type: incident/request/insumos. Full billing lifecycle |
| `recurring_tasks` | Definitions for auto-generated monthly tasks |
| `task_templates` | Saved task blueprints |
| `activity_logs` | Audit log for create/update/delete actions |
| `quotes` | Client quotes with line items. Types: standard/BOM |
| `quote_line_items` | Individual line items per quote |
| `uptime_kuma_config` | Single-row config for Uptime Kuma Socket.io connection |
| `status_pages` | Public status page definitions (slug → org name) |
| `monitor_feeds` | External JSON monitor endpoint subscriptions |
| `monitor_mappings` | Map Uptime Kuma monitor IDs to client/project |
| `company_settings` | Single-row: company name, logo (base64), address, etc. |

### Task lifecycle fields

```
tasks
├── type:          'incident' | 'request' | 'insumos'
├── status:        'not_started' | 'in_progress' | 'review' | 'completed'
├── priority:      'low' | 'medium' | 'high'
├── finished:      BOOLEAN (0/1)
├── billed:        BOOLEAN — marked after exporting/invoicing
├── billedAt:      DATETIME
├── paid:          BOOLEAN — marked after payment received
├── paidAt:        DATETIME
├── invoiceNumber: TEXT
├── approvalStatus:'pending' | 'approved' | 'rejected'  (insumos only)
├── approvedBy:    TEXT
├── vendor:        TEXT
└── receiptRef:    TEXT
```

---

## API Endpoints

All endpoints are under `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Returns JWT token |
| POST | `/api/auth/logout` | Yes | Invalidates session |
| PUT | `/api/users/:id/password` | Yes | Change password |

### Clients
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clients` | List all clients (includes yearly rates) |
| POST | `/api/clients` | Create client |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client (cascades to projects + tasks) |
| PATCH | `/api/clients/:id/archive` | Toggle archived state |
| GET | `/api/clients/:id/yearly-rates` | Get yearly rate history |
| POST | `/api/clients/:id/yearly-rates` | Upsert yearly rate |
| DELETE | `/api/clients/:id/yearly-rates/:rateId` | Delete yearly rate |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task (all fields) |
| DELETE | `/api/tasks/:id` | Delete task |

### Recurring Tasks, Templates, Projects
Standard CRUD at `/api/recurring-tasks`, `/api/task-templates`, `/api/projects`.

### Quotes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/quotes` | List quotes (with client name) |
| GET | `/api/quotes/:id` | Get quote with line items |
| POST | `/api/quotes` | Create quote + line items |
| PUT | `/api/quotes/:id` | Update quote + line items |
| DELETE | `/api/quotes/:id` | Delete quote |

### Reports & Backup
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/backup` | Export full DB as JSON |
| POST | `/api/restore` | Restore from JSON backup |
| GET | `/api/stats` | Task/client/project counts |
| GET | `/api/activity-logs` | Paginated audit log |

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/client-report/:slug/:year/:month` | Monthly report data for client portal |
| GET | `/api/public/company-settings` | Logo + name for public pages |
| GET | `/api/public/status/:slug` | Uptime Kuma status page data |

### Integrations
- `/api/uptime-kuma/*` — config, status, connect/disconnect
- `/api/status-pages/*` — public status page CRUD
- `/api/monitor-feeds/*` — JSON monitor endpoint CRUD
- `/api/monitor-mappings` — monitor → client/project mapping
- `/api/monitor-proxy` — server-side proxy to bypass CORS on external feeds
- `/api/company-settings` — GET/POST company branding

---

## Authentication

- **Mechanism**: JWT-like token stored in `localStorage` under `tasktracker_session` (base64-encoded JSON).
- **Session TTL**: 24 hours (configurable in `src/auth/authConfig.ts`).
- **Lockout**: 5 failed attempts → 15-minute lockout.
- **Roles**: `admin` | `user` (role-based UI gating; API currently uses presence of valid token).
- **Password hashing**: bcryptjs with salt rounds = 10 (server-side). Client-side `authService.ts` uses a legacy simple hash only for the in-memory fallback.
- **Default credentials** (Docker):
  - `admin` / `TaskTracker2025!`
  - `user` / `User2025!`
  - Override via env vars: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `USER_USERNAME`, `USER_PASSWORD`

---

## Running Locally

### Prerequisites
- Node.js 20+
- npm 9+

### Steps

```bash
# Install dependencies
npm install

# Start the API server (port 3001)
npm run dev:server

# In a second terminal, start the Vite dev server (port 5173)
npm run dev

# Or start both concurrently
npm run dev:full
```

Vite proxies `/api` → `http://localhost:3001` (see `vite.config.ts`).

The database will be created at `server/tasktracker.db` on first run.

### Initialize DB manually
```bash
node server/init-db.js
```

---

## Docker Deployment

### Quick start
```bash
chmod +x docker-deploy.sh
./docker-deploy.sh
```

App available at: `http://localhost:3000`

### Manual
```bash
docker-compose up --build -d
docker-compose logs -f
docker-compose down
```

### Container entrypoint flow
```
start-with-cron.sh
  1. node server/init-db.js      # create tables + default users
  2. node server/migrate.js      # run incremental migrations
  3. crond (daily backup at 2AM) # writes JSON to /app/data/backups/
  4. node server/index.js        # start Express server on PORT (default 3000)
```

### Data persistence
The SQLite DB and backups live in a Docker named volume `tasktracker_data` mounted at `/app/data`.

```yaml
volumes:
  tasktracker_data:
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `NODE_ENV` | — | `production` uses `/app/data/` for DB path |
| `ADMIN_USERNAME` | `admin` | Bootstrap admin username |
| `ADMIN_PASSWORD` | `TaskTracker2025!` | Bootstrap admin password |
| `USER_USERNAME` | `user` | Bootstrap user username |
| `USER_PASSWORD` | `User2025!` | Bootstrap user password |

Frontend env (`.env`, read by Vite at build time):
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base URL for API calls in dev (`http://localhost:3000`) |
| `VITE_SUPABASE_URL` | Supabase project URL (reserved, not used by core app) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (reserved) |

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `dev` | Vite dev server |
| `dev:server` | Express server with Node watch |
| `dev:full` | Both, concurrently |
| `build` | Vite production build → `dist/` |
| `migrate` | Run `server/migrate.js` against local DB |
| `migrate:yearly-rates` | One-off yearly rates migration |
| `fix:completed` | Fix tasks where `finished=1` but `status != completed` |
| `verify:status` | Report on task status consistency |
| `clean:orphaned` | Delete tasks with empty `client_id` / `project_id` |
| `clean:duplicates` | Interactive: find and delete duplicate tasks |
| `backup` | Run backup-cron.js manually |
| `check:status-pages` | Verify `status_pages` table exists |
| `clean:activity-log` | Trim activity log to last 1000 entries |
| `test:recurring` | Force all recurring tasks due today (dev helper) |

---

## Key Features & Implementation Notes

### Recurring Tasks
- Definitions stored in `recurring_tasks` table.
- On modal open (`RecurringTaskManager`), React effect checks `nextDue` against today and calls `addTask()` for any overdue entries, then updates `nextDue` to the following month.
- Supports: day-of-month, or Nth weekend (first/second/third/fourth/last Saturday/Sunday).
- Has optional `recurringStartDate` and `recurringEndDate`.
- Backfills missed months when a start date in the past is provided on creation.

### PDF Export (jsPDF)
- `PDFExporter` class in `src/utils/pdfExport.ts` wraps jsPDF + jspdf-autotable.
- Company logo stored as base64 in `company_settings.logo_url` to avoid CORS issues when embedding in PDF.
- `addClientReportSections()` is a shared method used by monthly, multi-month, and public report PDFs.
- Column widths tuned to fit within 182mm usable width (210mm A4 − 28mm margins).

### Markdown Export / AI Roundtrip
- `generateMarkdownReport()` produces a Markdown table with task rows keyed by `id.slice(-8)`.
- Includes a **Duplicate Analysis** section — groups tasks by description to surface potential billing errors.
- `parseMarkdownReport()` reads the tables back and `diffAgainstOriginal()` computes a diff.
- `MarkdownImportModal` lets users apply deletions and field edits after AI-assisted cleanup.

### Uptime Kuma Integration
- `UptimeKumaService` (server-side) connects via Socket.io to a Uptime Kuma instance.
- On DOWN heartbeat: creates a high-priority incident task (with configurable min-downtime threshold).
- Config persisted in `uptime_kuma_config` table (single row).
- Public status pages (`/status/:slug`) fetch live monitor data and overall status.

### Client Yearly Rates
- Each client can have different hourly rates per year via `client_yearly_rates`.
- PDF and markdown exports look up the rate for the year of each task date.
- Multi-year reports display all applicable rates in the header.

### CSV Import (Kimai format)
- Parses `Date`, `Duration`, `Price`, `Activity`, `Description` columns.
- Maps activity names (e.g. `"Incidentes IT"`) to task types.
- Inline row editing before import: change type, hours, cost, description.
- Duplicate check runs before each insert.

### Bulk Task Operations
- `BulkTaskOperations` modal supports: edit fields, quick-complete (1h default), reschedule, delete.
- Edit mode uses `UNCHANGED` sentinel value so only touched fields are patched.

### Supplies (Insumos) Billing Lifecycle
```
Not Billed → [Mark as Billed + optional invoice #] → Pending Payment → [Mark as Paid] → Paid
```
Tracked via `billed`, `billedAt`, `paid`, `paidAt`, `invoiceNumber` on the task row.

---

## Database Maintenance

```bash
# Check task status consistency
npm run verify:status

# Fix finished=1 tasks where status != 'completed'
npm run fix:completed

# Remove tasks with no client/project
npm run clean:orphaned

# Interactive duplicate removal
node server/remove-duplicates.js

# Trim activity log (keep last 1000)
node server/clean-activity-log.js

# Manual backup
npm run backup
```

**In Docker:**
```bash
docker exec <container> npm run fix:completed
docker exec <container> npm run verify:status
```

Backups are written automatically at 02:00 daily to `/app/data/backups/` (7 backups retained). Export/import is also available from the sidebar UI.

---

## Public URLs

| URL | Description |
|-----|-------------|
| `/report/:clientSlug/:year/:month` | Client-facing monthly report (no login required) |
| `/status/:slug` | Public uptime status page (no login required) |
| `/about` | Feature overview page |

---

*Last updated: 2026-07 · TaskTracker Pro by Cenas-Support*
