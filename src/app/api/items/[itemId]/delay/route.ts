import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

const postSchema = z.object({ reason: z.string().min(1).max(500) });

export async function POST(req: NextRequest, ctx: RouteContext<"/api/items/[itemId]/delay">) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "GM", "PRODUCTION", "PLANNER"].includes(session.user.role)) return new Response(null, { status: 403 });
  const { itemId } = await ctx.params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.orderItem.update({
      where: { id: itemId },
      data: { reasonOfDelay: parsed.data.reason },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "ORDER_ITEM", entityId: itemId,
      orderItemId: itemId, action: "UPDATE", fieldName: "reasonOfDelay",
      oldValue: updated.reasonOfDelay, newValue: parsed.data.reason,
    });
    return updated;
  });
  return Response.json(item);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/items/[itemId]/delay">) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (session.user.role !== "ADMIN") return new Response(null, { status: 403 });
  const { itemId } = await ctx.params;

  const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!item) return new Response(null, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({ where: { id: itemId }, data: { reasonOfDelay: null } });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "ORDER_ITEM", entityId: itemId,
      orderItemId: itemId, action: "UPDATE", fieldName: "reasonOfDelay",
      oldValue: item.reasonOfDelay, newValue: null,
    });
  });
  return new Response(null, { status: 204 });
}
