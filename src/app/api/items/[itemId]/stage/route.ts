import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
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
    (role === "PLANNER" && PLANNER_STAGES.includes(stage)) ||
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

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.orderItem.updateMany({
      where: { id: itemId, version },
      data: {
        [stageConfig.statusField]: status,
        [stageConfig.dateField]: date ? new Date(date) : null,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new Error("CONFLICT");
    }

    await writeAuditLog(tx, {
      userId: session.user.id,
      entityType: "ORDER_ITEM",
      entityId: itemId,
      orderItemId: itemId,
      action: "UPDATE",
      fieldName: stageConfig.statusField,
      oldValue: oldStatus,
      newValue: status,
    });

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

  return Response.json(updated);
}
