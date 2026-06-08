import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
  ppoNumber: z.string().min(1),
  clientName: z.string().min(1),
  orderDate: z.string(),
  rsd: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return new Response(null, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const existing = await prisma.salesOrder.findUnique({ where: { ppoNumber: parsed.data.ppoNumber } });
  if (existing) return Response.json({ error: "PPO number already exists" }, { status: 409 });

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.salesOrder.create({
      data: {
        ppoNumber: parsed.data.ppoNumber,
        clientName: parsed.data.clientName,
        orderDate: new Date(parsed.data.orderDate),
        rsd: new Date(parsed.data.rsd),
      },
    });
    await writeAuditLog(tx, {
      userId: session.user.id, entityType: "SALES_ORDER", entityId: o.id,
      action: "CREATE", newValue: o.ppoNumber,
    });
    return o;
  });

  return Response.json(order, { status: 201 });
}
