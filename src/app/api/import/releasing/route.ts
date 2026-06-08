import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseReleasingFile } from "@/lib/excel";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "TECHNICAL"].includes(session.user.role)) return new Response(null, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const confirm = formData.get("confirm") === "true";

  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseReleasingFile(buffer);

  if (errors.length) return Response.json({ errors, preview: [] });
  if (rows.length === 0) return Response.json({ errors: ["No data rows found"], preview: [] });

  // Resolve all matching items (all duplicates)
  const ppNumbers = [...new Set(rows.map(r => r.ppoNumber))];
  const orders = await prisma.salesOrder.findMany({
    where: { ppoNumber: { in: ppNumbers } },
    include: { items: true },
  });
  const orderMap = new Map(orders.map(o => [o.ppoNumber, o]));

  type Match = { itemId: string; ppoNumber: string; itemCode: string; currentStatus: string };
  const matches: Match[] = [];
  const notFound: string[] = [];

  for (const row of rows) {
    const order = orderMap.get(row.ppoNumber);
    if (!order) { notFound.push(`PPO "${row.ppoNumber}" not found`); continue; }
    const items = order.items.filter(i => i.itemCode === row.itemCode);
    if (items.length === 0) { notFound.push(`Item "${row.itemCode}" not found in ${row.ppoNumber}`); continue; }
    for (const item of items) {
      matches.push({ itemId: item.id, ppoNumber: row.ppoNumber, itemCode: row.itemCode, currentStatus: item.drawingStatus });
    }
  }

  const alreadyDone = matches.filter(m => m.currentStatus === "DONE").length;
  const toUpdate = matches.filter(m => m.currentStatus !== "DONE");

  if (!confirm) {
    return Response.json({
      errors: notFound,
      preview: {
        total: rows.length,
        matched: matches.length,
        toUpdate: toUpdate.length,
        alreadyDone,
        notFound: notFound.length,
        items: matches.map(m => ({ ...m, willChange: m.currentStatus !== "DONE" })),
      },
    });
  }

  // Apply
  await prisma.$transaction(async (tx) => {
    for (const m of toUpdate) {
      await tx.orderItem.update({
        where: { id: m.itemId },
        data: { drawingStatus: "DONE", version: { increment: 1 } },
      });
      await writeAuditLog(tx, {
        userId: session.user.id, entityType: "ORDER_ITEM", entityId: m.itemId,
        orderItemId: m.itemId, action: "UPDATE", fieldName: "drawingStatus",
        oldValue: m.currentStatus, newValue: "DONE", source: "EXCEL_IMPORT",
      });
    }
  });

  return Response.json({ updated: toUpdate.length, skipped: alreadyDone, notFound: notFound.length });
}
