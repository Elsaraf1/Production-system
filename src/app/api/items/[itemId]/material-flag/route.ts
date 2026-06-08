import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({ requiresMaterial: z.boolean() });

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/items/[itemId]/material-flag">) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "TECHNICAL"].includes(session.user.role)) return new Response(null, { status: 403 });

  const { itemId } = await ctx.params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const current = await prisma.orderItem.findUnique({ where: { id: itemId }, select: { requiresMaterial: true } });
  if (!current) return new Response(null, { status: 404 });

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.orderItem.update({
      where: { id: itemId },
      data: { requiresMaterial: parsed.data.requiresMaterial },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "ORDER_ITEM", entityId: itemId,
      orderItemId: itemId, action: "UPDATE", fieldName: "requiresMaterial",
      oldValue: String(current.requiresMaterial), newValue: String(parsed.data.requiresMaterial),
    });
    return updated;
  });

  return Response.json(item);
}
