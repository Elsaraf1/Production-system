@AGENTS.md

# Production Tracking Dashboard — Project Reference

## What this is
A cloud-hosted web app replacing a Google Sheet used by a furniture/decor manufacturing company (Batal Furniture). It tracks sales orders through 5 production stages with role-based access, audit trail, and Excel import.

## Status: Live in Production
- **Live app:** https://production-system-pi.vercel.app/
- **GitHub:** https://github.com/Elsaraf1/Production-system (branch `main`, auto-deploys to Vercel on push)
- **Default login:** `admin` / `admin123` (change via Admin → Users → key icon)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, TypeScript, Turbopack) |
| Database | **PostgreSQL via Supabase** (free tier) |
| ORM | **Prisma v7** — generates TS source to `src/generated/prisma/` |
| DB Adapter | **`@prisma/adapter-pg`** + **`pg`** — required in Prisma v7 (no embedded engine) |
| Auth | **NextAuth.js v5 beta** (Credentials provider, JWT sessions) |
| UI | **Tailwind CSS v4 + shadcn/ui** |
| Charts | **Recharts** |
| Excel | **xlsx (SheetJS)** |
| Hosting | **Vercel** + **Supabase** |

---

## Critical Prisma v7 Notes
- Client is **TypeScript source files** in `src/generated/prisma/` — NOT a compiled binary
- Import client as: `import { PrismaClient } from "@/generated/prisma/client"`
- **Every** `new PrismaClient()` requires an adapter: `new PrismaClient({ adapter: new PrismaPg(pool) })`
- `url` lives in the `prisma.config.ts` datasource block — NOT in `schema.prisma` (see Gotchas: `directUrl` is NOT supported there)
- Run schema changes with: `npx prisma db push --url "<session-pooler-url>"` (transaction pooler hangs on DDL)
- Run seed with: `npx tsx prisma/seed.ts`

## Critical Next.js 16 Notes
- **`middleware.ts` is deprecated** — use `src/proxy.ts` with exported function named `proxy`
- Route handler params are **async**: `const { id } = await ctx.params`
- Type route params with: `ctx: RouteContext<"/api/items/[itemId]/stage">`
- Read the relevant guide in `node_modules/next/dist/docs/` before writing any code

---

## Gotchas Hit During Development (don't re-discover these)
- **Prisma client import path**: must be `@/generated/prisma/client`, NOT `@/generated/prisma` (no index file there)
- **`prisma.config.ts` datasource block** only supports `url` (and `shadowDatabaseUrl`) in `@prisma/config` v7.8.0 — `directUrl` is NOT a valid key here. `DIRECT_URL` is only used directly by `prisma/seed.ts` / `prisma/reset-data.ts` via `pg.Pool`.
- **`prisma.$transaction(async (tx) => {...})` has a default 5000ms timeout.** Looping per-row `update()` + `auditLog.create()` over many Excel rows blows past this. Fix pattern: group rows by old value and use `updateMany`/`createMany` to cut round trips to ~O(distinct values), and pass `{ timeout: 30000 }` as a safety margin. Applied in `releasing`, `material-receive`, `material-request`, `inventory-update` import routes.
- **lucide-react icons don't accept a `title` prop** (`LucideProps` extends `SVGAttributes`, no `title`). Wrap in `<span title="...">` instead.
- **shadcn/ui `Select` `onValueChange`** can pass `string | null` — coalesce with `?? ""` before using as a literal union type.
- **Zod v4**: use `parsed.error.issues`, not `.errors`.
- **`xlsx` (SheetJS) needs `serverExternalPackages: ["xlsx"]`** in `next.config.ts` or it breaks in Vercel serverless functions (Turbopack bundling issue).
- **All API routes that the import UI calls must return JSON even on error** (wrap handler body in try/catch, return `Response.json({ errors: [...] }, { status: 500 })`). An unhandled exception returns an HTML/empty error page, and `res.json()` inside the client's `startTransition` throws "Unexpected end of JSON input", which crashes the page via the nearest Error Boundary ("This page couldn't load").
- **After `npx prisma generate`, restart any running `next dev` process.** A long-running dev server keeps the old generated client (and its enum validation) in memory — new enum values (e.g. new `PRMaterial` options) will fail validation until restarted.
- **`*.xlsx` / `*.xls` are gitignored** — don't commit real client data files (e.g. "Client order.xlsx").

---

## Environment Variables (`.env.local`)
```
DATABASE_URL="postgresql://postgres.gzodvukjstjakhhkedyu:Batal%40Dashboard@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://postgres.gzodvukjstjakhhkedyu:Batal%40Dashboard@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="0f0bd6fd081eac6423ebab7fdad99a0c97db6f052f396b9fdd28514537681601"
NEXTAUTH_URL="http://localhost:3000"
GMAIL_USER="..."            # optional — enables email notifications (src/lib/email.ts)
GMAIL_APP_PASSWORD="..."    # optional — Gmail App Password, not the account password
CRON_SECRET="..."           # optional — if set, /api/cron/in-progress-reminder requires `Authorization: Bearer <CRON_SECRET>`
```
- Both URLs point to the **session pooler** (port 5432) — works on IPv4 without paid add-on
- Supabase project: `gzodvukjstjakhhkedyu` / region: ap-southeast-1 (Singapore)
- DB password has `@` → URL-encoded as `%40`
- SSL is required: always use `ssl: { rejectUnauthorized: false }` in `new Pool()`
- `GMAIL_USER`/`GMAIL_APP_PASSWORD` are checked at runtime (not required to boot the app) — without them, `src/lib/email.ts` silently no-ops (`getTransport()` returns `null`). Status is surfaced on `/admin/notifications`.

---

## Database Schema

**Enums:**
- `Role`: ADMIN / GM / BD / PRODUCTION / PLANNER / TECHNICAL / PROCUREMENT / SALES — `GM` and `BD` have the same **permissions** as `PLANNER` everywhere in the codebase (always checked together, e.g. `role === "PLANNER" || role === "GM" || role === "BD"`); see [Role Permissions](#role-permissions). They are **excluded from automated email recipients** (see [Email Notifications](#email-notifications)) — GM/BD accounts were copy-created from Planner accounts and inherited Planner's email routing, which caused unwanted weekly reminder/notification traffic to GM and BD, so those `findMany` queries were reverted to `role: "PLANNER"` only. To get a GM or BD person on notifications, add their email to the CC list at `/admin/notifications` instead.
- `Department`: DRAWING / CARPENTRY / PAINTING / UPHOLSTERY / PACKING / PR_CREATION
- `StageStatus`: PENDING / IN_PROGRESS / DONE / NA
- `PRMaterial`: MARBLE / GLASS / MIRROR / PORCELAIN / METAL / HANDLES / BRASS / LAMITAK_LIPPING / OTHER
- `PRStatus`: DRAFT / SUBMITTED / APPROVED / ORDERED / RECEIVED / CANCELLED — note: both manual PR creation (`POST /api/items/[itemId]/prs`) and the Material Request import create PRs with status `ORDERED`, not `SUBMITTED`/`DRAFT`
- `EntityType`, `AuditAction`, `AuditSource`

**Models:**
- `User` — id, username (unique), passwordHash, displayName, role, department (nullable), email (nullable — used for notification routing), isActive
- `SalesOrder` — id, ppoNumber (unique), clientName, orderDate, rsd, version (optimistic lock), archivedAt (nullable — see [Archived Orders](#archived-orders))
- `OrderItem` — id, salesOrderId, itemCode, description, productionOrderNo, outstandingQty, requiresMaterial (default true — "needs no material" flag), ×5 stage status + date fields, reasonOfDelay, sortOrder, version
- `PurchaseRequisition` — id, orderItemId, prNumber (unique), material, quantity, unit, status, requestedDate, receivedDate, otherDescription (nullable, ≤20 chars, only set when material = `OTHER`), createdById, version
- `Note` — id, orderItemId, content, authorId, createdAt, deletedAt (soft delete), deletedById
- `AuditLog` — id, userId, entityType, entityId, orderItemId (denorm), action, fieldName, oldValue, newValue, source (UI/EXCEL_IMPORT), createdAt — **append-only**
- `CcEmail` — id, email (unique), label (nullable), createdAt — addresses auto-CC'd on every notification email (managed at `/admin/notifications`)
- `SystemSetting` — key (PK), value, updatedAt — generic key/value store; currently holds `overdue_thresholds` (JSON: days per stage before an overdue reminder fires)

---

## File Structure (key files)

```
prisma/
  schema.prisma           — models + enums (no url/directUrl here)
  prisma.config.ts        — datasource url, loads .env.local
  seed.ts                 — creates admin user + sample order
  reset-data.ts           — deletes all orders/items/PRs/notes/audit (keeps users)

src/
  proxy.ts                — route protection (replaces middleware.ts): auth redirect,
                            /admin/* = Admin only, /import = not SALES

  lib/
    prisma.ts             — singleton PrismaClient with PrismaPg adapter + SSL
    auth.ts               — NextAuth config (credentials + JWT, role/dept in session)
    audit.ts              — writeAuditLog() helper used by single-row write routes
    excel.ts              — SheetJS parsers for all 5 import types + sample-file builders
    email.ts              — nodemailer/Gmail sender + HTML templates for all notification
                             types; CC's every address in `CcEmail`; no-ops if Gmail env vars unset
    stages.ts             — STAGES constant (Drawing/Carpentry/Painting/Upholstery/Packing/PR)
                             + StageKey/StageRow types (used by /stages)
    order-item-match.ts   — shared PPO/Item Code row-matching helpers used by import routes
    department-stats.ts   — per-department aggregate helpers (dashboard)
    date.ts               — format() utility

  app/
    layout.tsx            — root layout
    page.tsx              — redirects to /dashboard or /login
    login/page.tsx        — credentials login form
    api/auth/[...nextauth]/route.ts
    api/orders/route.ts                    — POST create order (Admin)
    api/orders/[orderId]/route.ts          — GET order detail
    api/orders/[orderId]/items/route.ts    — POST add item to order (Admin)
    api/orders/[orderId]/archive/route.ts  — POST archive, DELETE unarchive (Admin) — see [Archived Orders](#archived-orders)
    api/items/[itemId]/route.ts            — item-level fetch
    api/items/[itemId]/stage/route.ts      — PATCH stage update (optimistic lock + audit + email)
    api/items/[itemId]/notes/route.ts      — GET list, POST add
    api/items/[itemId]/notes/[noteId]/route.ts — DELETE (soft)
    api/items/[itemId]/delay/route.ts      — POST set (Admin/GM/BD/Production/Planner), DELETE remove (Admin)
    api/items/[itemId]/material-flag/route.ts — PATCH requiresMaterial ("needs no material") (Admin/Technical)
    api/items/[itemId]/prs/route.ts        — GET list, POST create (Admin/Technical) + notify Procurement
    api/items/[itemId]/prs/[prId]/route.ts — PATCH status update (Admin/Procurement) + notify Technical
    api/import/route.ts                    — POST parse Planner xlsx → preview
    api/import/confirm/route.ts            — POST apply Planner import (create/update + audit)
    api/import/releasing/route.ts          — POST Releasing Order import (drawingStatus → DONE)
    api/import/material-request/route.ts   — POST Material Request import (creates PRs)
    api/import/material-receive/route.ts   — POST Material Receive import (PR status → RECEIVED)
    api/import/inventory-update/route.ts   — POST Inventory Update import (Production Order No + bulk "Inventored" → all stages DONE)
    api/import/sample/route.ts             — GET sample/template file per import type
    api/admin/users/route.ts               — POST create user (Admin)
    api/admin/users/[userId]/route.ts      — PATCH change password/email, DELETE deactivate (Admin)
    api/admin/settings/route.ts            — GET/PATCH SystemSetting key-value (Admin) — used for overdue_thresholds
    api/admin/cc-emails/route.ts           — GET list, POST add CC address (Admin)
    api/admin/cc-emails/[ccId]/route.ts    — DELETE remove CC address (Admin)
    api/admin/test-email/route.ts          — POST send a test email to verify Gmail config (Admin)
    api/cron/in-progress-reminder/route.ts — GET Vercel Cron target (Mon/Thu 06:00 UTC, see vercel.json):
                                              emails stage owners + PLANNER/GM/BD for stages stuck
                                              IN_PROGRESS past threshold, and Procurement for stale PRs

    (app)/
      layout.tsx          — app shell: auth check + sidebar
      dashboard/
        page.tsx          — KPI cards + stage chart + overdue list
        stage-chart.tsx   — Recharts stacked bar (client component)
      orders/
        page.tsx              — searchable order list (excludes archived); "New Order" button
                                 (Admin only); "Ready to Archive" badge + archive action per row (Admin)
        create-order-dialog.tsx — new-order form (client, calls POST /api/orders)
        archive-row-action.tsx  — inline confirm + POST /api/orders/[orderId]/archive (client, Admin)
        archived/
          page.tsx               — searchable list of archived orders + "Completed On" reference date
          archived-row-action.tsx — inline confirm + DELETE .../archive to unarchive (client, Admin)
        [orderId]/
          page.tsx              — server wrapper, fetches order
          order-detail-client.tsx — client: editable stage cells + item sheet
      update/page.tsx     — role-filtered pending items
      stages/
        page.tsx          — server wrapper grouping items by production stage (incl. derived PR
                             stage); excludes items belonging to archived orders
        stages-client.tsx — client: per-stage table view
      procurement/
        page.tsx              — server wrapper (view: any signed-in role; edit: Admin/Procurement);
                                 excludes PRs belonging to archived orders
        procurement-client.tsx — PR list (client)
      import/page.tsx     — Excel 5-card two-step import UI (Planner / Releasing / Material
                             Request / Material Receive / Inventory Update), role-filtered cards
      admin/
        users/
          page.tsx              — user list (server)
          create-user-form.tsx  — add user (client)
          user-actions.tsx      — change-password dialog + deactivate (client)
        audit/page.tsx    — audit log viewer (last 200 entries, no filters yet)
        data/
          page.tsx              — server wrapper, all orders + items + PRs
          admin-data-client.tsx — full data table (edit/manage, client)
        notifications/
          page.tsx               — server wrapper: email status, thresholds, CC list
          test-email-form.tsx    — send-test-email client form
          threshold-settings.tsx — per-stage overdue-day inputs (client, writes SystemSetting)
          cc-email-manager.tsx   — add/remove CC addresses (client)

  components/
    sidebar.tsx           — role-aware nav + sign out
    items/
      stage-status-badge.tsx  — color-coded badge per StageStatus
      stage-cell.tsx          — clickable dropdown + conflict dialog (client)
      item-details-sheet.tsx  — slide-over: Materials / Notes / Delay tabs (client)
      pr-summary-cell.tsx     — compact PR/material status icons for table rows
      pr-status-cell.tsx      — editable PR status cell (Procurement view)
      pr-status-badge.tsx     — color-coded badge per PRStatus
      production-order-cell.tsx — editable Production Order No cell
    stages/
      stage-table.tsx     — shared table for the /stages view
```

---

## Role Permissions

8 roles exist: **Admin, GM, BD, Production, Planner, Technical, Procurement, Sales**.
`GM` and `BD` are checked together with `Planner` at every call site in the codebase
(literally `role === "PLANNER" || role === "GM" || role === "BD"`) — they were added as
aliases with identical permissions to Planner, not as distinct permission tiers. There is
no dedicated "GM/BD" logic anywhere; if Planner's permissions change, update all three.

| Action | Admin | GM / BD | Production (own dept) | Planner | Technical | Procurement | Sales |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View everything | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update stage — Carpentry/Painting/Upholstery/Packing | ✓ | ✓ | ✓ (own dept) | ✓ | — | — | — |
| Update stage — Drawing | ✓ | — | ✓ (if dept=Drawing) | — | ✓ | — | — |
| Add/delete own notes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Delete any note | ✓ | — | — | — | — | — | — |
| Add Reason of Delay | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Remove Reason of Delay | ✓ | — | — | — | — | — | — |
| Toggle "needs no material" flag | ✓ | — | — | — | ✓ | — | — |
| Request material (check "Required") | ✓ | — | — | — | ✓ | — | — |
| Mark material arrived / update PR status | ✓ | — | — | — | — | ✓ | — |
| Create orders / add items to an order | ✓ | — | — | — | — | — | — |
| Excel import — Planner | ✓ | ✓ | — | ✓ | — | — | — |
| Excel import — Releasing Order | ✓ | — | — | — | ✓ | — | — |
| Excel import — Material Request | ✓ | — | — | — | ✓ | — | — |
| Excel import — Material Receive | ✓ | — | — | — | — | ✓ | — |
| Excel import — Inventory Update | ✓ | ✓ | — | ✓ | — | — | — |
| `/procurement` page (view) | ✓ | — | — | — | ✓ | ✓ | — |
| `/procurement` page (edit PR status) | ✓ | — | — | — | — | ✓ | — |
| User management (incl. password reset) | ✓ | — | — | — | — | — | — |
| Audit log | ✓ | — | — | — | — | — | — |
| `/admin/data` (raw table view) | ✓ | — | — | — | — | — | — |
| `/admin/notifications` (CC list, thresholds, test email) | ✓ | — | — | — | — | — | — |
| Archive / unarchive a completed order | ✓ | — | — | — | — | — | — |

Notes:
- `/import` is blocked entirely for Sales at the route level (`src/proxy.ts`); every other
  page is reachable by every authenticated role (view-only where no edit permission applies).
- Stage-done and material-request/-received emails are routed by role: Drawing→next stage
  goes to `PRODUCTION` in that department + `PLANNER` only (**not** `GM`/`BD` — see
  [Email Notifications](#email-notifications)); material requests go to `PROCUREMENT`;
  material received goes to `TECHNICAL`; new orders go to `TECHNICAL`.
- **Permissions vs. email recipients are not symmetric for GM/BD.** GM and BD share every
  edit permission with Planner (stage updates, imports, notes, delay), but are deliberately
  left out of the `role: { in: [...] } ` recipient queries in `src/lib/email.ts` call sites.
  Don't "fix" this by adding them back in — it was a reported bug, not an oversight.

---

## Optimistic Locking
Every `OrderItem` and `PurchaseRequisition` has `version: Int`. On PATCH:
1. Client sends current `version`
2. Server does `updateMany WHERE id=$id AND version=$version`
3. `rowsAffected === 0` → 409 conflict → UI shows "Keep their change / Override" dialog

---

## Excel Import
All five import types live under `/import` (cards filtered by role, locked cards show a
🔒 and the roles that can use them) and share the same two-step UI: Upload → preview
(POST without `confirm`) → user reviews → apply (POST with `confirm=true`, applies +
writes audit log with `source: EXCEL_IMPORT`). Parsers and sample-file builders are in
`src/lib/excel.ts`; sample files are downloaded via `GET /api/import/sample?type=<sampleType>`.

### 1. Planner Import — `POST /api/import` → `POST /api/import/confirm` (Admin, GM, BD, Planner)
Creates new sales orders/items or updates existing ones (diff-based).
- Required columns: `PPO Number`, `Item Code`
- Optional: `Client Name`, `Order Date`, `RSD`, `Description`, `Production Order No`, `Outstanding Qty`,
  `Drawing/Carpentry/Painting/Upholstery/Packing Status` + `Date`, `Reason of Delay`
- Valid statuses: `PENDING`, `IN_PROGRESS`/`WIP`, `DONE`/`Complete`, `NA`/`N/A`
- Setting `Production Order No` to `Inventored` marks all 5 stages Done, same as the
  Inventory Update import (see below).

### 2. Releasing Order Import — `POST /api/import/releasing` (Admin, Technical)
Sets `drawingStatus → DONE` for every matching item (including duplicate item codes
in the same order). Notifies Carpentry `PRODUCTION` users + `PLANNER` (not GM/BD — see
[Email Notifications](#email-notifications)).
- Required columns: `PPO Number`, `Item Code`

### 3. Material Request Import — `POST /api/import/material-request` (Admin, Technical)
Creates a `PurchaseRequisition` (status **`ORDERED`**, not `SUBMITTED` — same default as
manual PR creation via the item sheet) for each matched item/material that doesn't
already have an active (non-`CANCELLED`) request. A row with material `N/A` instead sets
`requiresMaterial = false` on the item. Notifies `PROCUREMENT`.
- Required columns: `PPO Number`, `Item Code`, `Material`
- Valid materials: `Marble`, `Glass`, `Mirror`, `Porcelain`, `Metal`, `Handles`/`Handle`,
  `Brass`, `Lamitak`/`Lipping`/`Lamitak & Lipping`, `Other`, or `N/A`

### 4. Material Receive Import — `POST /api/import/material-receive` (Admin, Procurement)
Sets matching `PurchaseRequisition.status → RECEIVED` (and `receivedDate = now`).
Notifies `TECHNICAL`.
- Required columns: `PPO Number`, `Item Code`, `Material`

### 5. Inventory Update Import — `POST /api/import/inventory-update` (Admin, GM, BD, Planner)
Matches rows by `Item ID` (not PPO/Item Code — the sample file download returns a live
export of every item's current `id` + `Production Order No` to round-trip). Updates
`productionOrderNo`; if the new value is `Inventored` (case-insensitive), every stage
that isn't already `NA` or `DONE` is also set to `DONE`.
- Required columns: `Item ID`, `Production Order No`
- Optional (display only): `PPO Number`, `Item Code`
- No email notification on this import type.

### Implementation notes
- All five import POST routes are wrapped in try/catch returning `Response.json({ errors: [...] }, { status: 500 })` on failure — never let an exception produce a non-JSON response (see Gotchas above).
- The "apply" step for releasing/material-request/material-receive/inventory-update batches
  DB writes with `updateMany`/`createMany` grouped by old value, inside
  `$transaction(..., { timeout: 30000 })`, to avoid the default 5000ms interactive-transaction
  timeout on large files.
- Releasing, Material Request, and Material Receive imports each trigger a bulk email
  notification (`notifyBulkReleasingDone` / `notifyBulkMaterialRequested` /
  `notifyBulkMaterialReceived` in `src/lib/email.ts`) after a successful confirm.

---

## Archived Orders
Purely a visibility/declutter feature — nothing is deleted. Once every `OrderItem` in a
`SalesOrder` has `productionOrderNo` (trimmed, case-insensitive) equal to `"Inventored"`,
the order is "ready to archive": `/orders` shows a **Ready to Archive** badge in place of
the usual Overdue/Due Soon/On Track status, and Admin gets an inline **Archive** action on
that row (`archive-row-action.tsx`, same confirm-then-fetch pattern as `cc-email-manager.tsx`).
Archiving is **not automatic** — an Admin has to click it — but a fully-Inventored order is
already treated as "not overdue" everywhere (dashboard + `/orders`) even before that click.

- `POST /api/orders/[orderId]/archive` (Admin) sets `SalesOrder.archivedAt = now()` after
  re-verifying every item is Inventored server-side (guards against a stale UI). `DELETE`
  on the same route unarchives (`archivedAt = null`). Both write an audit log entry
  (`entityType: SALES_ORDER`, `fieldName: "archivedAt"`).
- Archived orders disappear from `/orders`, `/stages`, and `/procurement`, and from the
  dashboard's Total Orders/Items, Completed Items, and Overdue Orders KPIs, and the Stage
  Breakdown chart. **The Average Time per Department chart is intentionally unaffected** —
  it's historical analytics built from `AuditLog`, not live status, so archived orders'
  data should keep counting toward long-run averages.
- They remain visible to every role (same visibility as `/orders`) on the dedicated
  `/orders/archived` page, showing a **Completed On** reference date — the latest of the
  5 stage-done dates across all the order's items, not the archive-click date itself.
  Admin gets an inline **Unarchive** action there.
- **Data-accuracy dependency**: the "Completed On" date only exists because the Inventory
  Update import (`inventory-update/route.ts`) and the Planner Import's `"Inventored"`
  shortcut (`import/confirm/route.ts` + `excel.ts` `parsePlannerFile`) now stamp each stage's
  date field (e.g. `drawingDate`) to the import timestamp whenever they force that stage to
  `DONE` — previously neither path touched the date fields at all, only the status enum.
  Orders fully completed before this fix will show "—" on the archived page.

---

## Email Notifications
Optional feature — no-ops entirely if `GMAIL_USER`/`GMAIL_APP_PASSWORD` aren't set (checked
per-send via `getTransport()` in `src/lib/email.ts`, not at boot). Uses `nodemailer` with
Gmail's `service: "gmail"` transport (App Password required, not the account password).

- **Every send** also CC's every address in the `CcEmail` table (`/admin/notifications`
  manages this list; Admin only).
- **`GM` and `BD` are deliberately excluded from every recipient query below** (`role: "PLANNER"`,
  not `role: { in: ["PLANNER", "GM", "BD"] }`). GM/BD accounts were created by copying Planner
  accounts, which initially copied Planner's email routing too — that flooded GM/BD inboxes
  with notifications they didn't want, so the three `findMany` recipient queries in
  `stage/route.ts`, `import/releasing/route.ts`, and `cron/in-progress-reminder/route.ts`
  were reverted to `PLANNER`-only. This is intentional, not a gap — do not re-add GM/BD here.
  If a specific GM or BD user needs these emails, add their address to the CC list at
  `/admin/notifications` instead of changing the role filter.
- **Event-driven notifications** (fired inline from the relevant API route):
  - Stage marked Done → next stage's `PRODUCTION` dept users + `PLANNER` (`stage/route.ts`)
  - Material requested → `PROCUREMENT` (`prs/route.ts` POST)
  - Material received → `TECHNICAL` (`prs/[prId]/route.ts` PATCH)
  - New order created → `TECHNICAL` (`orders/route.ts` POST)
  - Bulk Releasing / Material Request / Material Receive imports → same recipient rules as
    their single-row equivalents above
- **Scheduled reminder** — `GET /api/cron/in-progress-reminder`, registered as a Vercel Cron
  in `vercel.json` (`0 6 * * 1,4` → Monday & Thursday 06:00 UTC). Protected by `CRON_SECRET`
  if set (`Authorization: Bearer <CRON_SECRET>`). Emails:
  - Stage owners + `PLANNER` for any stage stuck `IN_PROGRESS` longer than its configured threshold
  - `PROCUREMENT` for any PR stuck `ORDERED` longer than its threshold
  - Thresholds are per-stage day counts stored in `SystemSetting` (`overdue_thresholds`,
    default 7 days for all 5 production stages, 10 for procurement), editable at
    `/admin/notifications`
- All email HTML is built by small template functions in `src/lib/email.ts`; failures are
  caught and logged (`console.error("[email] ...")`) but never block the underlying write —
  emails are best-effort, not part of the transaction.

---

## Seed / Reset
```bash
# Seed admin user + sample data
npx tsx prisma/seed.ts
# Default login: admin / admin123

# Wipe all order data (keep users)
npx tsx prisma/reset-data.ts

# Push schema changes to DB
npx prisma db push --url "postgresql://postgres.gzodvukjstjakhhkedyu:Batal%40Dashboard@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Regenerate Prisma client after schema change
npx prisma generate
```

---

## Completed
- [x] Deployed to Vercel (auto-deploy on push to `main`) + production env vars set
- [x] Excel import expanded to 5 types: Planner, Releasing Order, Material Request, Material Receive, Inventory Update (+ sample file downloads)
- [x] Materials/PR checklist on each item (Required/Arrived columns), "needs no material" flag
- [x] Added `BRASS` and `LAMITAK_LIPPING` to `PRMaterial`
- [x] Admin: change any user's password/email (`PATCH /api/admin/users/[userId]`) + deactivate
- [x] `/stages` view (items grouped by production stage, incl. derived PR stage) and `/admin/data` raw table view
- [x] `PLANNER` role with its own stage-update permissions and dedicated import tab
- [x] `GM` and `BD` roles added as Planner-equivalent aliases (same stage/import/note/delay permissions)
- [x] Fixed Prisma interactive-transaction timeouts on bulk imports (batched updateMany/createMany)
- [x] Hardened all import routes against unhandled errors (try/catch → JSON error response)
- [x] Create order form UI (`orders/create-order-dialog.tsx`, Admin only)
- [x] Email notification system (event-driven + Mon/Thu overdue cron), CC list, and per-stage overdue thresholds — `/admin/notifications`
- [x] Excluded `GM`/`BD` from automated email recipients (they'd inherited Planner's email routing when their accounts were copy-created; use CC list to opt a specific person back in)
- [x] Archived Orders: Admin-confirmed archiving of fully-Inventored orders, hidden from Orders/Stages/Procurement/most dashboard KPIs, browsable on `/orders/archived` with a real "Completed On" date

## What Still Needs Building
- [ ] Audit log filters (date range, user, entity type) — currently shows the last 200 entries unfiltered
- [ ] Excel per-department simplified templates
- [ ] Mobile responsive polish pass
