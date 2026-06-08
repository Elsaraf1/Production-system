import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

const editSchema = z.object({
  clientName: z.string().min(1).optional(),
  ppoNumber: z.string().min(1).optional(),
  orderDate: z.string().optional(),
  rsd: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/orders/[orderId]">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { orderId } = await ctx.params;
  const body = await req.json();
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const current = await prisma.salesOrder.findUnique({ where: { id: orderId } });
  if (!current) return new Response(null, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.clientName) data.clientName = parsed.data.clientName;
  if (parsed.data.ppoNumber) data.ppoNumber = parsed.data.ppoNumber;
  if (parsed.data.orderDate) data.orderDate = new Date(parsed.data.orderDate);
  if (parsed.data.rsd) data.rsd = new Date(parsed.data.rsd);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.salesOrder.update({ where: { id: orderId }, data });
    const changed = Object.entries(parsed.data).filter(
      ([k, v]) => v !== undefined && String(v) !== String((current as Record<string, unknown>)[k] ?? "")
    );
    for (const [field, newVal] of changed) {
      await writeAuditLog(tx, {
        userId: session.user.id, entityType: "SALES_ORDER", entityId: orderId,
        action: "UPDATE", fieldName: field,
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
  ctx: RouteContext<"/api/orders/[orderId]">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { orderId } = await ctx.params;
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true } } },
  });
  if (!order) return new Response(null, { status: 404 });

  const itemIds = order.items.map(i => i.id);
  await prisma.$transaction(async (tx) => {
    if (itemIds.length > 0) {
      await tx.auditLog.deleteMany({ where: { orderItemId: { in: itemIds } } });
      await tx.note.deleteMany({ where: { orderItemId: { in: itemIds } } });
      await tx.purchaseRequisition.deleteMany({ where: { orderItemId: { in: itemIds } } });
      await tx.orderItem.deleteMany({ where: { salesOrderId: orderId } });
    }
    await tx.auditLog.deleteMany({ where: { entityId: orderId, entityType: "SALES_ORDER" } });
    await tx.salesOrder.delete({ where: { id: orderId } });
  });
  return new Response(null, { status: 204 });
}
