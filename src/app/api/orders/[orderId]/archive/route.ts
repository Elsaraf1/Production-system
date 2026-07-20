import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/orders/[orderId]/archive">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { orderId } = await ctx.params;
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { items: { select: { productionOrderNo: true } } },
  });
  if (!order) return new Response(null, { status: 404 });
  if (order.archivedAt) return Response.json({ error: "Order is already archived" }, { status: 400 });

  const allInventored = order.items.length > 0 &&
    order.items.every(i => i.productionOrderNo.trim().toLowerCase() === "inventored");
  if (!allInventored) {
    return Response.json({ error: "Not every item is marked Inventored yet" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.salesOrder.update({ where: { id: orderId }, data: { archivedAt: new Date() } });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "SALES_ORDER", entityId: orderId,
      action: "UPDATE", fieldName: "archivedAt", oldValue: null, newValue: result.archivedAt!.toISOString(),
    });
    return result;
  });

  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/orders/[orderId]/archive">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { orderId } = await ctx.params;
  const order = await prisma.salesOrder.findUnique({ where: { id: orderId } });
  if (!order) return new Response(null, { status: 404 });
  if (!order.archivedAt) return Response.json({ error: "Order is not archived" }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.salesOrder.update({ where: { id: orderId }, data: { archivedAt: null } });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "SALES_ORDER", entityId: orderId,
      action: "UPDATE", fieldName: "archivedAt", oldValue: order.archivedAt!.toISOString(), newValue: null,
    });
    return result;
  });

  return Response.json(updated);
}
