import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["ORDERED", "RECEIVED", "CANCELLED"]),
  receivedDate: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/items/[itemId]/prs/[prId]">
) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "PROCUREMENT"].includes(session.user.role)) return new Response(null, { status: 403 });
  const { itemId, prId } = await ctx.params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const current = await prisma.purchaseRequisition.findUnique({ where: { id: prId } });
  if (!current) return new Response(null, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.purchaseRequisition.update({
      where: { id: prId },
      data: {
        status: parsed.data.status,
        // Auto-set receivedDate when marking as RECEIVED; clear it when un-receiving
        receivedDate: parsed.data.status === "RECEIVED"
          ? (parsed.data.receivedDate ? new Date(parsed.data.receivedDate) : new Date())
          : parsed.data.status === "ORDERED"
            ? null
            : undefined,
        version: { increment: 1 },
      },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "PURCHASE_REQUISITION", entityId: prId,
      orderItemId: itemId, action: "UPDATE", fieldName: "status",
      oldValue: current.status, newValue: parsed.data.status,
    });
    return result;
  });
  return Response.json(updated);
}
