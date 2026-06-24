import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseMaterialFile } from "@/lib/excel";
import { notifyBulkMaterialReceived } from "@/lib/email";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "PROCUREMENT"].includes(session.user.role)) return new Response(null, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const confirm = formData.get("confirm") === "true";
  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseMaterialFile(buffer);
  if (errors.length) return Response.json({ errors, preview: [] });
  if (rows.length === 0) return Response.json({ errors: ["No data rows found"], preview: [] });

  const ppNumbers = [...new Set(rows.map(r => r.ppoNumber))];
  const orders = await prisma.salesOrder.findMany({
    where: { ppoNumber: { in: ppNumbers } },
    include: { items: { include: { purchaseReqs: true } } },
  });
  const orderMap = new Map(orders.map(o => [o.ppoNumber, o]));

  type Match = { prId: string; itemId: string; ppoNumber: string; itemCode: string; material: string; currentStatus: string };
  const matches: Match[] = [];
  const notFound: string[] = [];

  for (const row of rows) {
    const order = orderMap.get(row.ppoNumber);
    if (!order) { notFound.push(`PPO "${row.ppoNumber}" not found`); continue; }
    const items = order.items.filter(i => i.itemCode === row.itemCode);
    if (!items.length) { notFound.push(`Item "${row.itemCode}" not found in ${row.ppoNumber}`); continue; }
    for (const item of items) {
      const pr = item.purchaseReqs.find(p => p.material === row.material && p.status !== "CANCELLED");
      if (!pr) { notFound.push(`Material "${row.material}" not requested for ${row.itemCode} in ${row.ppoNumber}`); continue; }
      matches.push({ prId: pr.id, itemId: item.id, ppoNumber: row.ppoNumber, itemCode: row.itemCode, material: row.material, currentStatus: pr.status });
    }
  }

  const alreadyReceived = matches.filter(m => m.currentStatus === "RECEIVED").length;
  const toUpdate = matches.filter(m => m.currentStatus !== "RECEIVED");

  if (!confirm) {
    return Response.json({
      errors: notFound,
      preview: {
        total: rows.length, matched: matches.length,
        toUpdate: toUpdate.length, alreadyReceived,
        notFound: notFound.length,
        items: matches.map(m => ({ ...m, willChange: m.currentStatus !== "RECEIVED" })),
      },
    });
  }

  // Batch by previous status to minimize round trips
  await prisma.$transaction(async (tx) => {
    const byStatus = new Map<string, string[]>();
    for (const m of toUpdate) {
      const ids = byStatus.get(m.currentStatus) ?? [];
      ids.push(m.prId);
      byStatus.set(m.currentStatus, ids);
    }
    for (const ids of byStatus.values()) {
      await tx.purchaseRequisition.updateMany({
        where: { id: { in: ids } },
        data: { status: "RECEIVED", receivedDate: new Date(), version: { increment: 1 } },
      });
    }
    if (toUpdate.length > 0) {
      await tx.auditLog.createMany({
        data: toUpdate.map(m => ({
          userId: session.user.id, entityType: "PURCHASE_REQUISITION" as const, entityId: m.prId,
          orderItemId: m.itemId, action: "UPDATE" as const, fieldName: "status",
          oldValue: m.currentStatus, newValue: "RECEIVED", source: "EXCEL_IMPORT" as const,
        })),
      });
    }
  }, { timeout: 30000 });

  if (toUpdate.length > 0) {
    try {
      const recipients = await prisma.user.findMany({ where: { role: "TECHNICAL", isActive: true, email: { not: null } }, select: { email: true } });
      await notifyBulkMaterialReceived(toUpdate.length, recipients.map(u => u.email!));
    } catch (err) { console.error("[email] notifyBulkMaterialReceived:", err); }
  }

  return Response.json({ updated: toUpdate.length, skipped: alreadyReceived, notFound: notFound.length });
  } catch (err) {
    console.error("[import/material-receive]", err);
    return Response.json({ errors: [`Server error: ${err instanceof Error ? err.message : String(err)}`], preview: null }, { status: 500 });
  }
}
