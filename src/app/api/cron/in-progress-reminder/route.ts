import { prisma } from "@/lib/prisma";
import { notifyInProgressOverdue, STAGE_INFO } from "@/lib/email";
import { NextRequest } from "next/server";
import type { Department } from "@/generated/prisma/client";

const STAGE_FIELD_MAP: Record<string, { fieldName: string; department: Department | null; role: string }> = {
  drawing:    { fieldName: "drawingStatus",    department: "DRAWING",    role: "TECHNICAL" },
  carpentry:  { fieldName: "carpentryStatus",  department: "CARPENTRY",  role: "PRODUCTION" },
  painting:   { fieldName: "paintingStatus",   department: "PAINTING",   role: "PRODUCTION" },
  upholstery: { fieldName: "upholsteryStatus", department: "UPHOLSTERY", role: "PRODUCTION" },
  packing:    { fieldName: "packingStatus",    department: "PACKING",    role: "PRODUCTION" },
};

export async function GET(req: NextRequest) {
  // Verify cron secret when set (Vercel cron jobs send Authorization: Bearer <CRON_SECRET>)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(null, { status: 401 });
    }
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find all items currently with any IN_PROGRESS stage
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
      include: {
        salesOrder: { select: { ppoNumber: true, clientName: true } },
      },
    });

    if (inProgressItems.length === 0) {
      return Response.json({ checked: 0, overdue: 0 });
    }

    const itemIds = inProgressItems.map(i => i.id);
    const stageFieldNames = Object.values(STAGE_FIELD_MAP).map(s => s.fieldName);

    // Get most recent audit entry per (itemId, fieldName) where stage → IN_PROGRESS
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        orderItemId: { in: itemIds },
        newValue: "IN_PROGRESS",
        fieldName: { in: stageFieldNames },
      },
      select: { orderItemId: true, fieldName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // Build map of itemId:fieldName → most recent IN_PROGRESS transition date
    const latestMap = new Map<string, Date>();
    for (const e of auditEntries) {
      const key = `${e.orderItemId}:${e.fieldName}`;
      if (!latestMap.has(key)) latestMap.set(key, e.createdAt);
    }

    // Collect overdue items per stage
    type OverdueItem = { ppoNumber: string; itemCode: string; clientName: string; daysInProgress: number };
    const overdueByStage = new Map<string, OverdueItem[]>();

    for (const item of inProgressItems) {
      for (const [stageName, cfg] of Object.entries(STAGE_FIELD_MAP)) {
        const statusValue = item[cfg.fieldName as keyof typeof item];
        if (statusValue !== "IN_PROGRESS") continue;

        const key = `${item.id}:${cfg.fieldName}`;
        const startedAt = latestMap.get(key) ?? new Date(0); // fallback: treat as very old
        if (startedAt > sevenDaysAgo) continue; // not yet overdue

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

    let totalOverdue = 0;

    // Send one email per stage with overdue items
    for (const [stageName, items] of overdueByStage) {
      totalOverdue += items.length;
      const cfg = STAGE_FIELD_MAP[stageName];

      try {
        // Notify: the responsible role for that stage + PLANNERs + ADMINs
        const [stageUsers, plannerUsers, adminUsers] = await Promise.all([
          cfg.role === "TECHNICAL"
            ? prisma.user.findMany({ where: { role: "TECHNICAL", isActive: true, email: { not: null } }, select: { email: true } })
            : prisma.user.findMany({ where: { role: "PRODUCTION", department: cfg.department as Department, isActive: true, email: { not: null } }, select: { email: true } }),
          prisma.user.findMany({ where: { role: "PLANNER", isActive: true, email: { not: null } }, select: { email: true } }),
          prisma.user.findMany({ where: { role: "ADMIN", isActive: true, email: { not: null } }, select: { email: true } }),
        ]);

        const emails = [...new Set([...stageUsers, ...plannerUsers, ...adminUsers].map(u => u.email!))];
        if (emails.length > 0) {
          await notifyInProgressOverdue(stageName, items, emails);
        }
      } catch (err) {
        console.error(`[cron/in-progress-reminder] email failed for stage ${stageName}:`, err);
      }
    }

    return Response.json({ checked: inProgressItems.length, overdue: totalOverdue });
  } catch (err) {
    console.error("[cron/in-progress-reminder]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
