import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { notifyMaterialRequested } from "@/lib/email";
import { NextRequest } from "next/server";
import { z } from "zod";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/items/[itemId]/prs">) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  const { itemId } = await ctx.params;

  const prs = await prisma.purchaseRequisition.findMany({
    where: { orderItemId: itemId },
    include: { createdBy: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(prs);
}

const postSchema = z.object({
  prNumber: z.string().min(1),
  material: z.enum(["MARBLE", "GLASS", "MIRROR", "PORCELAIN", "METAL", "HANDLES", "BRASS", "LAMITAK_LIPPING", "OTHER"]),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  requestedDate: z.string().nullable().optional(),
  otherDescription: z.string().max(20).optional().or(z.literal("")),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/items/[itemId]/prs">) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "TECHNICAL"].includes(session.user.role)) return new Response(null, { status: 403 });
  const { itemId } = await ctx.params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const pr = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseRequisition.create({
      data: {
        orderItemId: itemId,
        prNumber: parsed.data.prNumber,
        material: parsed.data.material,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        requestedDate: parsed.data.requestedDate ? new Date(parsed.data.requestedDate) : null,
        createdById: session.user.id,
        status: "ORDERED",
        otherDescription: parsed.data.material === "OTHER" ? (parsed.data.otherDescription || null) : null,
      },
      include: { createdBy: { select: { displayName: true } } },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "PURCHASE_REQUISITION", entityId: created.id,
      orderItemId: itemId, action: "CREATE", newValue: `${created.material} x${created.quantity}`,
    });
    return created;
  });
  try {
    const [recipients, item] = await Promise.all([
      prisma.user.findMany({ where: { role: "PROCUREMENT", isActive: true, email: { not: null } }, select: { email: true } }),
      prisma.orderItem.findUnique({ where: { id: itemId }, include: { salesOrder: { select: { ppoNumber: true } } } }),
    ]);
    if (item) await notifyMaterialRequested(
      { itemCode: item.itemCode, ppoNumber: item.salesOrder.ppoNumber },
      parsed.data.material === "OTHER" && parsed.data.otherDescription
        ? `Other — ${parsed.data.otherDescription}`
        : parsed.data.material,
      recipients.map(u => u.email!)
    );
  } catch (err) { console.error("[email] notifyMaterialRequested:", err); }

  return Response.json(pr, { status: 201 });
}
