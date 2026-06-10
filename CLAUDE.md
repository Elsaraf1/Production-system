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
- **`prisma.$transaction(async (tx) => {...})` has a default 5000ms timeout.** Looping per-row `update()` + `auditLog.create()` over many Excel rows blows past this. Fix pattern: group rows by old value and use `updateMany`/`createMany` to cut round trips to ~O(distinct values), and pass `{ timeout: 30000 }` as a safety margin. Applied in `releasing`, `material-receive`, `material-request` import routes.
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
```
- Both URLs point to the **session pooler** (port 5432) — works on IPv4 without paid add-on
- Supabase project: `gzodvukjstjakhhkedyu` / region: ap-southeast-1 (Singapore)
- DB password has `@` → URL-encoded as `%40`
- SSL is required: always use `ssl: { rejectUnauthorized: false }` in `new Pool()`

---

## Database Schema

**Enums:**
- `Role`: ADMIN / PRODUCTION / PLANNER / TECHNICAL / PROCUREMENT / SALES
- `Department`: DRAWING / CARPENTRY / PAINTING / UPHOLSTERY / PACKING / PR_CREATION
- `StageStatus`: PENDING / IN_PROGRESS / DONE / NA
- `PRMaterial`: MARBLE / GLASS / MIRROR / PORCELAIN / METAL / HANDLES / BRASS / LAMITAK_LIPPING / OTHER
- `PRStatus`: DRAFT / SUBMITTED / APPROVED / ORDERED / RECEIVED / CANCELLED
- `EntityType`, `AuditAction`, `AuditSource`

**Models:**
- `User` — id, username (unique), passwordHash, displayName, role, department (nullable), isActive
- `SalesOrder` — id, ppoNumber (unique), clientName, orderDate, rsd, version (optimistic lock)
- `OrderItem` — id, salesOrderId, itemCode, description, productionOrderNo, outstandingQty, requiresMaterial (default true — "needs no material" flag), ×5 stage status + date fields, reasonOfDelay, sortOrder, version
- `PurchaseRequisition` — id, orderItemId, prNumber (unique), material, quantity, unit, status, requestedDate, receivedDate, createdById, version
- `Note` — id, orderItemId, content, authorId, createdAt, deletedAt (soft delete), deletedById
- `AuditLog` — id, userId, entityType, entityId, orderItemId (denorm), action, fieldName, oldValue, newValue, source (UI/EXCEL_IMPORT), createdAt — **append-only**

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
    excel.ts              — SheetJS parsers for all 4 import types + sample-file builders
    stages.ts             — STAGES constant + StageKey/StageRow types (used by /stages)
    date.ts               — format() utility

  app/
    layout.tsx            — root layout
    page.tsx              — redirects to /dashboard or /login
    login/page.tsx        — credentials login form
    api/auth/[...nextauth]/route.ts
    api/orders/route.ts                    — POST create order (Admin)
    api/orders/[orderId]/route.ts          — GET order detail
    api/orders/[orderId]/items/route.ts    — POST add item to order
    api/items/[itemId]/route.ts            — item-level fetch
    api/items/[itemId]/stage/route.ts      — PATCH stage update (optimistic lock + audit)
    api/items/[itemId]/notes/route.ts      — GET list, POST add
    api/items/[itemId]/notes/[noteId]/route.ts — DELETE (soft)
    api/items/[itemId]/delay/route.ts      — POST set, DELETE remove (Admin/Production/Planner)
    api/items/[itemId]/material-flag/route.ts — PATCH requiresMaterial ("needs no material")
    api/items/[itemId]/prs/route.ts        — GET list, POST create (material checklist)
    api/items/[itemId]/prs/[prId]/route.ts — PATCH status update
    api/import/route.ts                    — POST parse Planner xlsx → preview
    api/import/confirm/route.ts            — POST apply Planner import (create/update + audit)
    api/import/releasing/route.ts          — POST Releasing Order import (drawingStatus → DONE)
    api/import/material-request/route.ts   — POST Material Request import (creates PRs)
    api/import/material-receive/route.ts   — POST Material Receive import (PR status → RECEIVED)
    api/import/sample/route.ts             — GET sample/template file per import type
    api/admin/users/route.ts               — POST create user (Admin)
    api/admin/users/[userId]/route.ts      — PATCH change password, DELETE deactivate (Admin)

    (app)/
      layout.tsx          — app shell: auth check + sidebar
      dashboard/
        page.tsx          — KPI cards + stage chart + overdue list
        stage-chart.tsx   — Recharts stacked bar (client component)
      orders/
        page.tsx          — searchable order list
        [orderId]/
          page.tsx              — server wrapper, fetches order
          order-detail-client.tsx — client: editable stage cells + item sheet
      update/page.tsx     — role-filtered pending items
      stages/
        page.tsx          — server wrapper grouping items by production stage
        stages-client.tsx — client: per-stage table view
      procurement/
        page.tsx              — server wrapper
        procurement-client.tsx — PR list (client)
      import/page.tsx     — Excel 4-tab two-step import UI (Planner / Releasing /
                             Material Request / Material Receive), role-filtered tabs
      admin/
        users/
          page.tsx              — user list (server)
          create-user-form.tsx  — add user (client)
          user-actions.tsx      — change-password dialog + deactivate (client)
        audit/page.tsx    — audit log viewer
        data/
          page.tsx              — server wrapper, all orders + items + PRs
          admin-data-client.tsx — full data table (edit/manage, client)

  components/
    sidebar.tsx           — role-aware nav + sign out
    items/
      stage-status-badge.tsx  — color-coded badge per StageStatus
      stage-cell.tsx          — clickable dropdown + conflict dialog (client)
      item-details-sheet.tsx  — slide-over: Materials / Notes / Delay tabs (client)
      pr-summary-cell.tsx     — compact PR/material status icons for table rows
    stages/
      stage-table.tsx     — shared table for the /stages view
```

---

## Role Permissions

| Action | Admin | Production (own dept) | Planner | Technical | Procurement | Sales |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| View everything | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update own stage | ✓ | ✓ (own dept) | Carpentry/Painting/Upholstery/Packing | Drawing only | — | — |
| Add/delete own notes | ✓ | ✓ | ✓ | ✓ | — | — |
| Delete any note | ✓ | — | — | — | — | — |
| Add Reason of Delay | ✓ | ✓ | ✓ | — | — | — |
| Remove Reason of Delay | ✓ | — | — | — | — | — |
| Toggle "needs no material" / required materials | ✓ | — | — | ✓ | — | — |
| Mark material arrived | ✓ | — | — | — | ✓ | — |
| Update PR status | ✓ | — | — | — | ✓ | — |
| Create orders | ✓ | — | — | — | — | — |
| Excel import — Planner | ✓ | — | ✓ | — | — | — |
| Excel import — Releasing Order | ✓ | — | — | ✓ | — | — |
| Excel import — Material Request | ✓ | — | — | ✓ | — | — |
| Excel import — Material Receive | ✓ | — | — | — | ✓ | — |
| User management (incl. password reset) | ✓ | — | — | — | — | — |
| Audit log | ✓ | — | — | — | — | — |
| `/admin/data` (raw table view) | ✓ | — | — | — | — | — |

---

## Optimistic Locking
Every `OrderItem` and `PurchaseRequisition` has `version: Int`. On PATCH:
1. Client sends current `version`
2. Server does `updateMany WHERE id=$id AND version=$version`
3. `rowsAffected === 0` → 409 conflict → UI shows "Keep their change / Override" dialog

---

## Excel Import
All four import types live under `/import` (tabs filtered by role) and share the same
two-step UI: Upload → preview (POST without `confirm`) → user reviews → apply
(POST with `confirm=true`, applies + writes audit log). Parsers and sample-file
builders are in `src/lib/excel.ts`; sample files are downloaded via `GET /api/import/sample`.

### 1. Planner Import — `POST /api/import` → `POST /api/import/confirm` (Admin, Planner)
Creates new sales orders/items or updates existing ones (diff-based).
- Required columns: `PPO Number`, `Item Code`
- Optional: `Client Name`, `Order Date`, `RSD`, `Description`, `Production Order No`, `Outstanding Qty`,
  `Drawing/Carpentry/Painting/Upholstery/Packing Status` + `Date`, `Reason of Delay`
- Valid statuses: `PENDING`, `IN_PROGRESS`/`WIP`, `DONE`/`Complete`, `NA`/`N/A`

### 2. Releasing Order Import — `POST /api/import/releasing` (Admin, Technical)
Sets `drawingStatus → DONE` for every matching item (including duplicate item codes
in the same order).
- Required columns: `PPO Number`, `Item Code`

### 3. Material Request Import — `POST /api/import/material-request` (Admin, Technical)
Creates a `PurchaseRequisition` (status `SUBMITTED`) for each matched item/material
that doesn't already have an active request.
- Required columns: `PPO Number`, `Item Code`, `Material`
- Valid materials: `Marble`, `Glass`, `Mirror`, `Porcelain`, `Metal`, `Handles`/`Handle`,
  `Brass`, `Lamitak`/`Lipping`/`Lamitak & Lipping`, `Other`

### 4. Material Receive Import — `POST /api/import/material-receive` (Admin, Procurement)
Sets matching `PurchaseRequisition.status → RECEIVED` (and `receivedDate = now`).
- Required columns: `PPO Number`, `Item Code`, `Material`

### Implementation notes
- All four import POST routes are wrapped in try/catch returning `Response.json({ errors: [...] }, { status: 500 })` on failure — never let an exception produce a non-JSON response (see Gotchas above).
- The "apply" step for releasing/material-request/material-receive batches DB writes
  with `updateMany`/`createMany` grouped by old value, inside `$transaction(..., { timeout: 30000 })`,
  to avoid the default 5000ms interactive-transaction timeout on large files.

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
- [x] Excel import expanded to 4 types: Planner, Releasing Order, Material Request, Material Receive (+ sample file downloads)
- [x] Materials/PR checklist on each item (Required/Arrived columns), "needs no material" flag
- [x] Added `BRASS` and `LAMITAK_LIPPING` to `PRMaterial`
- [x] Admin: change any user's password (`PATCH /api/admin/users/[userId]`) + deactivate
- [x] `/stages` view (items grouped by production stage) and `/admin/data` raw table view
- [x] `PLANNER` role with its own stage-update permissions and dedicated import tab
- [x] Fixed Prisma interactive-transaction timeouts on bulk imports (batched updateMany/createMany)
- [x] Hardened all import routes against unhandled errors (try/catch → JSON error response)

## What Still Needs Building
- [ ] Create order form UI (API exists at `POST /api/orders`, no page yet)
- [ ] Audit log filters (date range, user, entity type)
- [ ] Excel per-department simplified templates
- [ ] Mobile responsive polish pass
