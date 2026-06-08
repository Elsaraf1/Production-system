import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
  itemCode: z.string().min(1),
  description: z.string().default(""),
  productionOrderNo: z.string().default(""),
  outstandingQty: z.number().int().min(0).default(0),
  drawingStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).default("PENDING"),
  carpentryStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).default("PENDING"),
  paintingStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).default("PENDING"),
  upholsteryStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).default("PENDING"),
  packingStatus: z.enum(["PENDING", "IN_PROGRESS", "DONE", "NA"]).default("PENDING"),
});

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/orders/[orderId]/items">
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const { orderId } = await ctx.params;
  const order = await prisma.salesOrder.findUnique({ where: { id: orderId }, include: { _count: { select: { items: true } } } });
  if (!order) return new Response(null, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.orderItem.create({
      data: {
        salesOrderId: orderId,
        ...parsed.data,
        sortOrder: order._count.items,
      },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "ORDER_ITEM", entityId: created.id,
      orderItemId: created.id, action: "CREATE", newValue: created.itemCode,
    });
    return created;
  });

  return Response.json(item, { status: 201 });
}
