import { prisma } from "@/lib/prisma";

const STAGE_FIELDS = [
  { field: "drawingStatus",    label: "Drawing" },
  { field: "carpentryStatus",  label: "Carpentry" },
  { field: "paintingStatus",   label: "Painting" },
  { field: "upholsteryStatus", label: "Upholstery" },
  { field: "packingStatus",    label: "Packing" },
] as const;

export interface DepartmentDuration {
  department: string;
  avgDays: number | null;
  count: number;
}

export async function getAverageStageDurations(): Promise<DepartmentDuration[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      fieldName: { in: STAGE_FIELDS.map(s => s.field) },
      action: "UPDATE",
      orderItemId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: { orderItemId: true, fieldName: true, newValue: true, createdAt: true },
  });

  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  const pendingStart = new Map<string, Date>();

  for (const log of logs) {
    const key = `${log.orderItemId}:${log.fieldName}`;
    if (log.newValue === "IN_PROGRESS") {
      pendingStart.set(key, log.createdAt);
    } else if (log.newValue === "DONE") {
      const start = pendingStart.get(key);
      if (start) {
        const days = (log.createdAt.getTime() - start.getTime()) / 86400000;
        if (days >= 0) {
          sums.set(log.fieldName!, (sums.get(log.fieldName!) ?? 0) + days);
          counts.set(log.fieldName!, (counts.get(log.fieldName!) ?? 0) + 1);
        }
        pendingStart.delete(key);
      }
    } else {
      pendingStart.delete(key);
    }
  }

  const results: DepartmentDuration[] = STAGE_FIELDS.map(({ field, label }) => {
    const count = counts.get(field) ?? 0;
    const sum = sums.get(field) ?? 0;
    return {
      department: label,
      avgDays: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
      count,
    };
  });

  const receivedPRs = await prisma.purchaseRequisition.findMany({
    where: { status: "RECEIVED", requestedDate: { not: null }, receivedDate: { not: null } },
    select: { requestedDate: true, receivedDate: true },
  });

  let prSum = 0;
  let prCount = 0;
  for (const pr of receivedPRs) {
    const days = (pr.receivedDate!.getTime() - pr.requestedDate!.getTime()) / 86400000;
    if (days >= 0) {
      prSum += days;
      prCount++;
    }
  }

  results.push({
    department: "Procurement (PR)",
    avgDays: prCount > 0 ? Math.round((prSum / prCount) * 10) / 10 : null,
    count: prCount,
  });

  return results;
}
