import { prisma } from "@/lib/prisma";
import { notifyInProgressOverdue, notifyProcurementOverdue } from "@/lib/email";
import { NextRequest } from "next/server";
import type { Department } from "@/generated/prisma/client";

const STAGE_CFG: Record<string, { fieldName: string; department: Department | null; role: string }> = {
  drawing:    { fieldName: "drawingStatus",    department: "DRAWING",    role: "TECHNICAL" },
  carpentry:  { fieldName: "carpentryStatus",  department: "CARPENTRY",  role: "PRODUCTION" },
  painting:   { fieldName: "paintingStatus",   department: "PAINTING",   role: "PRODUCTION" },
  upholstery: { fieldName: "upholsteryStatus", department: "UPHOLSTERY", role: "PRODUCTION" },
  packing:    { fieldName: "packingStatus",    department: "PACKING",    role: "PRODUCTION" },
};

const DEFAULT_THRESHOLDS = { drawing: 7, carpentry: 7, painting: 7, upholstery: 7, packing: 7, procurement: 10 };
type Thresholds = typeof DEFAULT_THRESHOLDS;

async function getThresholds(): Promise<Thresholds> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "overdue_thresholds" } });
    if (setting) return { ...DEFAULT_THRESHOLDS, ...JSON.parse(setting.value) };
  } catch { /* table may not exist yet — use defaults */ }
  return { ...DEFAULT_THRESHOLDS };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) return new Response(null, { status: 401 });
  }

  try {
    const thresholds = await getThresholds();
    const stageFieldNames = Object.values(STAGE_CFG).map(c => c.fieldName);

    // ── Production stage overdue check ──────────────────────────────────────

    const inProgressItems = await prisma.orderItem.findMany({
      where: {
        OR: [
          { drawingStatus: "IN_PROGRESS" },
          { carpentryStatus: "IN_PROGRESS" },
          { paintingStatus: "IN_PROGRESS" },
          { upholsteryStatus: "IN_PROGRESS" },
          { packingStatus: "IN_PROGRESS" },
        ],
      },
      include: { salesOrder: { select: { ppoNumber: true, clientName: true } } },
    });

    let stageOverdueTotal = 0;

    if (inProgressItems.length > 0) {
      const itemIds = inProgressItems.map(i => i.id);

      // Most recent audit entry per (itemId, fieldName) where stage → IN_PROGRESS
      const auditEntries = await prisma.auditLog.findMany({
        where: {
          orderItemId: { in: itemIds },
          newValue: "IN_PROGRESS",
          fieldName: { in: stageFieldNames },
        },
        select: { orderItemId: true, fieldName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      // Map: `${itemId}:${fieldName}` → most recent IN_PROGRESS transition date
      const latestMap = new Map<string, Date>();
      for (const e of auditEntries) {
        const key = `${e.orderItemId}:${e.fieldName}`;
        if (!latestMap.has(key)) latestMap.set(key, e.createdAt);
      }

      // Collect overdue items per stage
      type OverdueItem = { ppoNumber: string; itemCode: string; clientName: string; daysInProgress: number };
      const overdueByStage = new Map<string, OverdueItem[]>();

      for (const item of inProgressItems) {
        for (const [stageName, cfg] of Object.entries(STAGE_CFG)) {
          const statusValue = (item as Record<string, unknown>)[cfg.fieldName];
          if (statusValue !== "IN_PROGRESS") continue;

          const thresholdDays = thresholds[stageName as keyof Thresholds] ?? 7;
          const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

          const key = `${item.id}:${cfg.fieldName}`;
          // Fall back to item.createdAt when no explicit IN_PROGRESS audit entry exists
          // (items created directly as IN_PROGRESS via Planner import won't have one)
          const startedAt = latestMap.get(key) ?? item.createdAt;
          if (startedAt > thresholdDate) continue;

          const daysInProgress = Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
          if (!overdueByStage.has(stageName)) overdueByStage.set(stageName, []);
          overdueByStage.get(stageName)!.push({
            ppoNumber: item.salesOrder.ppoNumber,
            itemCode: item.itemCode,
            clientName: item.salesOrder.clientName,
            daysInProgress,
          });
        }
      }

      for (const [stageName, items] of overdueByStage) {
        stageOverdueTotal += items.length;
        const cfg = STAGE_CFG[stageName];
        try {
          const [stageUsers, plannerUsers, adminUsers] = await Promise.all([
            cfg.role === "TECHNICAL"
              ? prisma.user.findMany({ where: { role: "TECHNICAL", isActive: true, email: { not: null } }, select: { email: true } })
              : prisma.user.findMany({ where: { role: "PRODUCTION", department: cfg.department as Department, isActive: true, email: { not: null } }, select: { email: true } }),
            prisma.user.findMany({ where: { role: { in: ["PLANNER", "GM", "BD"] }, isActive: true, email: { not: null } }, select: { email: true } }),
            prisma.user.findMany({ where: { role: "ADMIN", isActive: true, email: { not: null } }, select: { email: true } }),
          ]);
          const emails = [...new Set([...stageUsers, ...plannerUsers, ...adminUsers].map(u => u.email!))];
          if (emails.length > 0) await notifyInProgressOverdue(stageName, items, emails);
        } catch (err) {
          console.error(`[cron] email failed for stage ${stageName}:`, err);
        }
      }
    }

    // ── Procurement overdue check ────────────────────────────────────────────

    const procThreshold = thresholds.procurement ?? 10;
    const procThresholdDate = new Date(Date.now() - procThreshold * 24 * 60 * 60 * 1000);

    const overduePRs = await prisma.purchaseRequisition.findMany({
      where: { status: "ORDERED", requestedDate: { lte: procThresholdDate } },
      include: {
        orderItem: { include: { salesOrder: { select: { ppoNumber: true, clientName: true } } } },
      },
    });

    if (overduePRs.length > 0) {
      try {
        const [procUsers, adminUsers] = await Promise.all([
          prisma.user.findMany({ where: { role: "PROCUREMENT", isActive: true, email: { not: null } }, select: { email: true } }),
          prisma.user.findMany({ where: { role: "ADMIN", isActive: true, email: { not: null } }, select: { email: true } }),
        ]);
        const emails = [...new Set([...procUsers, ...adminUsers].map(u => u.email!))];
        if (emails.length > 0) {
          await notifyProcurementOverdue(
            overduePRs.map(pr => ({
              ppoNumber: pr.orderItem.salesOrder.ppoNumber,
              itemCode: pr.orderItem.itemCode,
              clientName: pr.orderItem.salesOrder.clientName,
              material: pr.material,
              daysOrdered: Math.floor((Date.now() - (pr.requestedDate ?? pr.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            })),
            emails
          );
        }
      } catch (err) {
        console.error("[cron] procurement overdue email failed:", err);
      }
    }

    return Response.json({ stageOverdue: stageOverdueTotal, procurementOverdue: overduePRs.length });
  } catch (err) {
    console.error("[cron/in-progress-reminder]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
