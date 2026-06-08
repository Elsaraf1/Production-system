@AGENTS.md

# Production Tracking Dashboard — Project Reference

## What this is
A cloud-hosted web app replacing a Google Sheet used by a furniture/decor manufacturing company. It tracks sales orders through 5 production stages with role-based access, audit trail, and Excel import.

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
- `url` and `directUrl` both live in `prisma.config.ts` datasource block — NOT in `schema.prisma`
- Run schema changes with: `npx prisma db push --url "<session-pooler-url>"` (transaction pooler hangs on DDL)
- Run seed with: `npx tsx prisma/seed.ts`

## Critical Next.js 16 Notes
- **`middleware.ts` is deprecated** — use `src/proxy.ts` with exported function named `proxy`
- Route handler params are **async**: `const { id } = await ctx.params`
- Type route params with: `ctx: RouteContext<"/api/items/[itemId]/stage">`
- Read the relevant guide in `node_modules/next/dist/docs/` before writing any code

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

**Enums:** `Role` (ADMIN/PRODUCTION/TECHNICAL/PROCUREMENT/SALES), `Department` (DRAWING/CARPENTRY/PAINTING/UPHOLSTERY/PACKING/PR_CREATION), `StageStatus` (PENDING/IN_PROGRESS/DONE/NA), `PRMaterial`, `PRStatus`, `EntityType`, `AuditAction`, `AuditSource`

**Models:**
- `User` — id, username (unique), passwordHash, displayName, role, department (nullable), isActive
- `SalesOrder` — id, ppoNumber (unique), clientName, orderDate, rsd, version (optimistic lock)
- `OrderItem` — id, salesOrderId, itemCode, description, productionOrderNo, outstandingQty, ×5 stage status + date fields, reasonOfDelay, sortOrder, version
- `PurchaseRequisition` — id, orderItemId, prNumber (unique), material, quantity, unit, status, requestedDate, receivedDate, createdById, version
- `Note` — id, orderItemId, content, authorId, createdAt, deletedAt (soft delete), deletedById
- `AuditLog` — id, userId, entityType, entityId, orderItemId (denorm), action, fieldName, oldValue, newValue, source (UI/EXCEL_IMPORT), createdAt — **append-only**

---

## File Structure (key files)

```
prisma/
  schema.prisma           — models + enums (no url/directUrl here)
  prisma.config.ts        — datasource url + directUrl, loads .env.local
  seed.ts                 — creates admin user + sample order
  reset-data.ts           — deletes all orders/items/PRs/notes/audit (keeps users)

src/
  proxy.ts                — route protection (replaces middleware.ts)
  lib/
    prisma.ts             — singleton PrismaClient with PrismaPg adapter + SSL
    auth.ts               — NextAuth config (credentials + JWT, role/dept in session)
    audit.ts              — writeAuditLog() helper used by all write routes
    excel.ts              — SheetJS parse + validate + diff engine + template builder
    date.ts               — format() utility

  app/
    layout.tsx            — root layout
    page.tsx              — redirects to /dashboard or /login
    login/page.tsx        — credentials login form
    api/auth/[...nextauth]/route.ts
    api/orders/route.ts               — POST create order (Admin)
    api/items/[itemId]/stage/route.ts — PATCH stage update (optimistic lock + audit)
    api/items/[itemId]/notes/route.ts — GET list, POST add
    api/items/[itemId]/notes/[noteId]/route.ts — DELETE (soft)
    api/items/[itemId]/delay/route.ts — POST set, DELETE remove (Admin only)
    api/items/[itemId]/prs/route.ts   — GET list, POST create
    api/items/[itemId]/prs/[prId]/route.ts — PATCH status update
    api/import/route.ts               — POST parse xlsx → preview
    api/import/confirm/route.ts       — POST apply import with audit
    api/import/template/route.ts      — GET download blank template
    api/admin/users/route.ts          — POST create user (Admin)

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
      procurement/page.tsx — PR list
      import/page.tsx     — Excel two-step import UI
      admin/
        users/
          page.tsx        — user list (server)
          create-user-form.tsx — add user (client)
        audit/page.tsx    — audit log viewer

  components/
    sidebar.tsx           — role-aware nav + sign out
    items/
      stage-status-badge.tsx  — color-coded badge per StageStatus
      stage-cell.tsx          — clickable dropdown + conflict dialog (client)
      item-details-sheet.tsx  — slide-over: Notes / Delay / PRs tabs (client)
```

---

## Role Permissions

| Action | Admin | Production (own dept) | Technical | Procurement | Sales |
|---|:---:|:---:|:---:|:---:|:---:|
| View everything | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update own stage | ✓ | ✓ | Drawing only | — | — |
| Add/delete own notes | ✓ | ✓ | ✓ | — | — |
| Delete any note | ✓ | — | — | — | — |
| Add Reason of Delay | ✓ | ✓ | — | — | — |
| Remove Reason of Delay | ✓ | — | — | — | — |
| Create PR | ✓ | — | ✓ | — | — |
| Update PR status | ✓ | — | — | ✓ | — |
| Create orders | ✓ | — | — | — | — |
| Excel import | ✓ | ✓ | ✓ | ✓ | — |
| User management | ✓ | — | — | — | — |
| Audit log | ✓ | — | — | — | — |

---

## Optimistic Locking
Every `OrderItem` and `PurchaseRequisition` has `version: Int`. On PATCH:
1. Client sends current `version`
2. Server does `updateMany WHERE id=$id AND version=$version`
3. `rowsAffected === 0` → 409 conflict → UI shows "Keep their change / Override" dialog

---

## Excel Import
- **Parser:** `src/lib/excel.ts` — case-insensitive column matching, flexible status normalisation
- **Flow:** Upload → `POST /api/import` (parse + preview) → user reviews → `POST /api/import/confirm` (apply + audit)
- **Column names accepted** (case-insensitive):
  - `PPO Number` / `ppo` (**required**)
  - `Item Code` / `item_code` (**required**)
  - `Client Name`, `Order Date`, `RSD`, `Description`, `Production Order No`, `Outstanding Qty`
  - `Drawing Status`, `Drawing Date`, `Carpentry Status`, `Carpentry Date`
  - `Painting Status`, `Painting Date`, `Upholstery Status`, `Upholstery Date`
  - `Packing Status`, `Packing Date`, `Reason of Delay`
- **Valid statuses:** `PENDING`, `IN_PROGRESS`/`WIP`, `DONE`/`Complete`, `NA`/`N/A`

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

## What Still Needs Building
- [ ] Create order form UI (API exists at `POST /api/orders`, no page yet)
- [ ] Edit/deactivate users (API only has create)
- [ ] Audit log filters (date range, user, entity type)
- [ ] Excel per-department simplified templates
- [ ] Mobile responsive polish pass
- [ ] Deploy to Vercel + set production env vars
