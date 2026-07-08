import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { notifyStageDone, STAGE_INFO, STAGE_ORDER } from "@/lib/email";
import { NextRequest } from "next/server";
import { z } from "zod";
import type { Department, StageStatus } from "@/generated/prisma/client";

const stageMap: Record<string, { statusField: string; dateField: string; department: Department }> = {
  drawing:    { statusField: "drawingStatus",    dateField: "drawingDate",    department: "DRAWING" },
  carpentry:  { statusField: "carpentryStatus",  dateField: "carpentryDate",  department: "CARPENTRY" },
  painting:   { statusField: "paintingStatus",   dateField: "paintingDate",   department: "PAINTING" },
  upholstery: { statusField: "upholsteryStatus", dateField: "upholsteryDate", department: "UPHOLSTERY" },
  packing:    { statusField: "packingStatus",    dateField: "packingDate",    department: "PACKING" },
};


const schema = z.object({
  stage: z.enum(["drawing", "carpentry", "painting", "upholstery", "packing"]),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]),
  date: z.string().nullable().optional(),
  version: z.number().int(),
});

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/items/[itemId]/stage">
) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });

  const { itemId } = await ctx.params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { stage, status, date, version } = parsed.data;
  const stageConfig = stageMap[stage];

  const { role, department } = session.user;
  const PLANNER_STAGES = ["carpentry", "painting", "upholstery", "packing"];
  const canUpdate =
    role === "ADMIN" ||
    (role === "PRODUCTION" && department === stageConfig.department) ||
    ((role === "PLANNER" || role === "GM") && PLANNER_STAGES.includes(stage)) ||
    (role === "TECHNICAL" && stage === "drawing");

  if (!canUpdate) return new Response(null, { status: 403 });

  const current = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!current) return new Response(null, { status: 404 });

  if (current.version !== version) {
    return Response.json(
      { conflict: true, current },
      { status: 409 }
    );
  }

  const oldStatus = current[stageConfig.statusField as keyof typeof current] as StageStatus;

  const updateData: Record<string, unknown> = {
    [stageConfig.statusField]: status,
    [stageConfig.dateField]: date ? new Date(date) : null,
    version: { increment: 1 },
  };

  const auditEntries: { fieldName: string; oldValue: StageStatus; newValue: StageStatus }[] = [
    { fieldName: stageConfig.statusField, oldValue: oldStatus, newValue: status },
  ];

  // When a stage is marked Done, auto-start the next stage (skipping any N/A stages)
  if (status === "DONE") {
    const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
    for (let i = idx + 1; i < STAGE_ORDER.length; i++) {
      const nextConfig = stageMap[STAGE_ORDER[i]];
      const nextStatus = current[nextConfig.statusField as keyof typeof current] as StageStatus;
      if (nextStatus === "NA") continue;
      if (nextStatus === "PENDING") {
        updateData[nextConfig.statusField] = "IN_PROGRESS";
        auditEntries.push({ fieldName: nextConfig.statusField, oldValue: nextStatus, newValue: "IN_PROGRESS" });
      }
      break;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.orderItem.updateMany({
      where: { id: itemId, version },
      data: updateData,
    });

    if (result.count === 0) {
      throw new Error("CONFLICT");
    }

    for (const entry of auditEntries) {
      await writeAuditLog(tx, {
        userId: session.user.id,
        entityType: "ORDER_ITEM",
        entityId: itemId,
        orderItemId: itemId,
        action: "UPDATE",
        fieldName: entry.fieldName,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      });
    }

    return tx.orderItem.findUnique({ where: { id: itemId } });
  }).catch(async (err) => {
    if (err.message === "CONFLICT") {
      return null;
    }
    throw err;
  });

  if (!updated) {
    const fresh = await prisma.orderItem.findUnique({ where: { id: itemId } });
    return Response.json({ conflict: true, current: fresh }, { status: 409 });
  }

  if (status === "DONE" && updated) {
    // Find the first stage after this one that is not DONE and not NA
    const idx = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number]);
    let nextKey: string | null = null;
    for (let i = idx + 1; i < STAGE_ORDER.length; i++) {
      const k = STAGE_ORDER[i];
      const cfg = stageMap[k];
      const st = updated[cfg.statusField as keyof typeof updated] as StageStatus;
      if (st !== "DONE" && st !== "NA") { nextKey = k; break; }
    }
    if (nextKey) {
      const nextInfo = STAGE_INFO[nextKey];
      try {
        const [deptUsers, plannerUsers, item] = await Promise.all([
          prisma.user.findMany({ where: { role: "PRODUCTION", department: nextInfo.department as Department, isActive: true, email: { not: null } }, select: { email: true } }),
          prisma.user.findMany({ where: { role: { in: ["PLANNER", "GM"] }, isActive: true, email: { not: null } }, select: { email: true } }),
          prisma.orderItem.findUnique({ where: { id: itemId }, include: { salesOrder: { select: { ppoNumber: true, clientName: true } } } }),
        ]);
        const emails = [...new Set([...deptUsers, ...plannerUsers].map(u => u.email!))];
        if (item) await notifyStageDone(
          { itemCode: item.itemCode, ppoNumber: item.salesOrder.ppoNumber, clientName: item.salesOrder.clientName },
          stage,
          nextInfo.label,
          emails
        );
      } catch (err) { console.error("[email] notifyStageDone:", err); }
    }
  }

  return Response.json(updated);
}
