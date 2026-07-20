import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAGES, type StageKey, type StageRow } from "@/lib/stages";
import { StagesClient } from "./stages-client";
import type { PRStatus, StageStatus } from "@/generated/prisma/client";

const STAGE_FIELDS = {
  DRAWING:    { statusField: "drawingStatus",    dateField: "drawingDate" },
  CARPENTRY:  { statusField: "carpentryStatus",  dateField: "carpentryDate" },
  PAINTING:   { statusField: "paintingStatus",   dateField: "paintingDate" },
  UPHOLSTERY: { statusField: "upholsteryStatus", dateField: "upholsteryDate" },
  PACKING:    { statusField: "packingStatus",    dateField: "packingDate" },
} as const;

interface PRInfo {
  status: PRStatus;
  requestedDate: Date | null;
  receivedDate: Date | null;
}

// PR isn't a manual stage status on OrderItem — it's derived from the linked
// Purchase Requisitions plus the "requiresMaterial" flag (the only thing that
// has to be set by hand, since "needs nothing" can't be inferred from absence of PRs).
function derivePrStatus(requiresMaterial: boolean, prs: PRInfo[]): StageStatus {
  if (!requiresMaterial) return "NA";
  const active = prs.filter(pr => pr.status !== "CANCELLED");
  if (active.length === 0) return "PENDING";
  return active.every(pr => pr.status === "RECEIVED") ? "DONE" : "IN_PROGRESS";
}

function latestPrDate(prs: PRInfo[]): Date | null {
  let latest: Date | null = null;
  for (const pr of prs) {
    if (pr.status === "CANCELLED") continue;
    for (const d of [pr.receivedDate, pr.requestedDate]) {
      if (d && (!latest || d > latest)) latest = d;
    }
  }
  return latest;
}

export default async function StagesPage() {
  const session = await auth();
  if (!session) return null;

  const items = await prisma.orderItem.findMany({
    where: { salesOrder: { archivedAt: null } },
    include: {
      salesOrder: true,
      purchaseReqs: { select: { status: true, requestedDate: true, receivedDate: true } },
    },
    orderBy: [{ salesOrder: { rsd: "asc" } }, { sortOrder: "asc" }],
  });

  const data = {} as Record<StageKey, StageRow[]>;
  for (const { key } of STAGES) {
    data[key] = items.map(item => {
      const base = {
        id: item.id,
        salesOrderId: item.salesOrderId,
        ppoNumber: item.salesOrder.ppoNumber,
        clientName: item.salesOrder.clientName,
        rsd: item.salesOrder.rsd.toISOString(),
        itemCode: item.itemCode,
        description: item.description,
        productionOrderNo: item.productionOrderNo,
        outstandingQty: item.outstandingQty,
        version: item.version,
      };
      if (key === "PR") {
        return {
          ...base,
          status: derivePrStatus(item.requiresMaterial, item.purchaseReqs),
          date: latestPrDate(item.purchaseReqs)?.toISOString() ?? null,
        };
      }
      const { statusField, dateField } = STAGE_FIELDS[key];
      return {
        ...base,
        status: item[statusField],
        date: item[dateField]?.toISOString() ?? null,
      };
    });
  }

  const department = session.user.department;
  let defaultStage: StageKey = "DRAWING";
  if (department === "PR_CREATION") defaultStage = "PR";
  else if (department && department in STAGE_FIELDS) defaultStage = department as StageKey;

  const { role } = session.user;
  const canEdit: Record<StageKey, boolean> = {
    DRAWING:    role === "ADMIN" || (role === "PRODUCTION" && department === "DRAWING") || role === "TECHNICAL",
    CARPENTRY:  role === "ADMIN" || (role === "PRODUCTION" && department === "CARPENTRY") || role === "PLANNER" || role === "GM" || role === "BD",
    PAINTING:   role === "ADMIN" || (role === "PRODUCTION" && department === "PAINTING") || role === "PLANNER" || role === "GM" || role === "BD",
    UPHOLSTERY: role === "ADMIN" || (role === "PRODUCTION" && department === "UPHOLSTERY") || role === "PLANNER" || role === "GM" || role === "BD",
    PACKING:    role === "ADMIN" || (role === "PRODUCTION" && department === "PACKING") || role === "PLANNER" || role === "GM" || role === "BD",
    PR: false,
  };

  return <StagesClient data={data} defaultStage={defaultStage} canEdit={canEdit} />;
}
