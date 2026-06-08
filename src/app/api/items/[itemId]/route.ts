import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

const editSchema = z.object({
  description: z.string().optional(),
  productionOrderNo: z.string().optional(),
  outstandingQty: z.number().int().min(0).optional(),
  drawingStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).optional(),
  carpentryStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).optional(),
  paintingStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).optional(),
  upholsteryStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).optional(),
  packingStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).optional(),
  reasonOfDelay: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/items/[itemId]">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { itemId } = await ctx.params;
  const body = await req.json();
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const current = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!current) return new Response(null, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.orderItem.update({
      where: { id: itemId },
      data: { ...parsed.data, version: { increment: 1 } },
    });
    const changed = Object.entries(parsed.data).filter(
      ([k, v]) => v !== undefined && v !== (current as Record<string, unknown>)[k]
    );
    for (const [field, newVal] of changed) {
      await writeAuditLog(tx, {
        userId: session.user.id, entityType: "ORDER_ITEM", entityId: itemId,
        orderItemId: itemId, action: "UPDATE", fieldName: field,
        oldValue: String((current as Record<string, unknown>)[field] ?? ""),
        newValue: String(newVal ?? ""),
      });
    }
    return result;
  });
  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/items/[itemId]">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { itemId } = await ctx.params;
  await prisma.$transaction(async (tx) => {
    await tx.note.deleteMany({ where: { orderItemId: itemId } });
    await tx.purchaseRequisition.deleteMany({ where: { orderItemId: itemId } });
    await tx.auditLog.deleteMany({ where: { orderItemId: itemId } });
    await tx.orderItem.delete({ where: { id: itemId } });
  });
  return new Response(null, { status: 204 });
}
