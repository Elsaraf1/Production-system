import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseMaterialFile, NO_MATERIAL_VALUE } from "@/lib/excel";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "TECHNICAL"].includes(session.user.role)) return new Response(null, { status: 403 });

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

  type Match = { itemId: string; ppoNumber: string; itemCode: string; material: string; alreadyRequested: boolean };
  const matches: Match[] = [];
  const notFound: string[] = [];

  for (const row of rows) {
    const order = orderMap.get(row.ppoNumber);
    if (!order) { notFound.push(`PPO "${row.ppoNumber}" not found`); continue; }
    const items = order.items.filter(i => i.itemCode === row.itemCode);
    if (!items.length) { notFound.push(`Item "${row.itemCode}" not found in ${row.ppoNumber}`); continue; }
    for (const item of items) {
      if (row.material === NO_MATERIAL_VALUE) {
        matches.push({ itemId: item.id, ppoNumber: row.ppoNumber, itemCode: row.itemCode, material: NO_MATERIAL_VALUE, alreadyRequested: !item.requiresMaterial });
        continue;
      }
      const existing = item.purchaseReqs.find(p => p.material === row.material && p.status !== "CANCELLED");
      matches.push({ itemId: item.id, ppoNumber: row.ppoNumber, itemCode: row.itemCode, material: row.material, alreadyRequested: !!existing });
    }
  }

  const materialMatches = matches.filter(m => m.material !== NO_MATERIAL_VALUE);
  const noMaterialMatches = matches.filter(m => m.material === NO_MATERIAL_VALUE);

  const toCreate = materialMatches.filter(m => !m.alreadyRequested);
  const toMarkNoMaterial = [...new Map(
    noMaterialMatches.filter(m => !m.alreadyRequested).map(m => [m.itemId, m])
  ).values()];

  if (!confirm) {
    return Response.json({
      errors: notFound,
      preview: {
        total: rows.length, matched: matches.length,
        toCreate: toCreate.length + toMarkNoMaterial.length,
        alreadyRequested: matches.length - toCreate.length - toMarkNoMaterial.length,
        notFound: notFound.length,
        items: matches.map(m => ({
          ppoNumber: m.ppoNumber, itemCode: m.itemCode,
          material: m.material === NO_MATERIAL_VALUE ? "N/A" : m.material,
          willChange: !m.alreadyRequested,
        })),
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    if (toCreate.length > 0) {
      const prData = toCreate.map(m => ({
        id: randomUUID(),
        orderItemId: m.itemId,
        prNumber: `${m.itemId.slice(-6).toUpperCase()}-${m.material}-IMP`,
        material: m.material as "MARBLE" | "GLASS" | "MIRROR" | "PORCELAIN" | "METAL" | "HANDLES" | "BRASS" | "LAMITAK_LIPPING" | "OTHER",
        quantity: 1, unit: "-", status: "SUBMITTED" as const,
        requestedDate: new Date(),
        createdById: session.user.id,
      }));

      await tx.purchaseRequisition.createMany({ data: prData });
      await tx.auditLog.createMany({
        data: toCreate.map((m, i) => ({
          userId: session.user.id, entityType: "PURCHASE_REQUISITION" as const, entityId: prData[i].id,
          orderItemId: m.itemId, action: "CREATE" as const, source: "EXCEL_IMPORT" as const,
          newValue: `${m.material} requested`,
        })),
      });
    }

    if (toMarkNoMaterial.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: toMarkNoMaterial.map(m => m.itemId) } },
        data: { requiresMaterial: false },
      });
      await tx.auditLog.createMany({
        data: toMarkNoMaterial.map(m => ({
          userId: session.user.id, entityType: "ORDER_ITEM" as const, entityId: m.itemId,
          orderItemId: m.itemId, action: "UPDATE" as const, fieldName: "requiresMaterial",
          oldValue: "true", newValue: "false", source: "EXCEL_IMPORT" as const,
        })),
      });
    }
  }, { timeout: 30000 });

  return Response.json({
    created: toCreate.length,
    markedNA: toMarkNoMaterial.length,
    skipped: matches.length - toCreate.length - toMarkNoMaterial.length,
    notFound: notFound.length,
  });
  } catch (err) {
    console.error("[import/material-request]", err);
    return Response.json({ errors: [`Server error: ${err instanceof Error ? err.message : String(err)}`], preview: null }, { status: 500 });
  }
}
