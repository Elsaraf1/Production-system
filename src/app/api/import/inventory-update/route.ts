import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseInventoryFile } from "@/lib/excel";
import { NextRequest } from "next/server";

const STAGE_FIELDS = ["drawingStatus", "carpentryStatus", "paintingStatus", "upholsteryStatus", "packingStatus"] as const;
type StageField = typeof STAGE_FIELDS[number];

const STAGE_LABELS: Record<StageField, string> = {
  drawingStatus: "Drawing", carpentryStatus: "Carpentry", paintingStatus: "Painting",
  upholsteryStatus: "Upholstery", packingStatus: "Packing",
};

export async function POST(req: NextRequest) {
  try {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "GM", "PLANNER"].includes(session.user.role)) return new Response(null, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const confirm = formData.get("confirm") === "true";
  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parseInventoryFile(buffer);
  if (errors.length) return Response.json({ errors, preview: [] });
  if (rows.length === 0) return Response.json({ errors: ["No data rows found"], preview: [] });

  const itemIds = [...new Set(rows.map(r => r.itemId))];
  const items = await prisma.orderItem.findMany({ where: { id: { in: itemIds } } });
  const itemMap = new Map(items.map(i => [i.id, i]));

  type StageChange = { field: StageField; old: string; newVal: string };
  type Match = {
    itemId: string; ppoNumber: string; itemCode: string;
    oldPO: string; newPO: string; stageChanges: StageChange[];
  };
  const matches: Match[] = [];
  const notFound: string[] = [];

  for (const row of rows) {
    const item = itemMap.get(row.itemId);
    if (!item) { notFound.push(`Item ID "${row.itemId}" not found (PPO ${row.ppoNumber || "?"} / ${row.itemCode || "?"})`); continue; }
    if (!row.productionOrderNo || row.productionOrderNo === item.productionOrderNo) continue;

    const stageChanges: StageChange[] = [];
    if (row.productionOrderNo.toLowerCase() === "inventored") {
      for (const field of STAGE_FIELDS) {
        const current = item[field];
        if (current !== "NA" && current !== "DONE") {
          stageChanges.push({ field, old: current, newVal: "DONE" });
        }
      }
    }

    matches.push({
      itemId: item.id, ppoNumber: row.ppoNumber || "?", itemCode: row.itemCode || item.itemCode,
      oldPO: item.productionOrderNo, newPO: row.productionOrderNo, stageChanges,
    });
  }

  if (!confirm) {
    return Response.json({
      errors: notFound,
      preview: {
        total: rows.length, matched: matches.length, toUpdate: matches.length, notFound: notFound.length,
        items: matches.map(m => ({
          ppoNumber: m.ppoNumber, itemCode: m.itemCode, willChange: true,
          changes: [
            `Production Order No: ${m.oldPO || "(empty)"} → ${m.newPO}`,
            ...m.stageChanges.map(c => `${STAGE_LABELS[c.field]}: ${c.old} → ${c.newVal}`),
          ],
        })),
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    const auditData: Array<{
      userId: string; entityType: "ORDER_ITEM"; entityId: string; orderItemId: string;
      action: "UPDATE"; fieldName: string; oldValue: string | null; newValue: string | null; source: "EXCEL_IMPORT";
    }> = [];

    for (const m of matches) {
      const updateData: Record<string, unknown> = { productionOrderNo: m.newPO, version: { increment: 1 } };
      for (const c of m.stageChanges) updateData[c.field] = c.newVal;
      await tx.orderItem.update({ where: { id: m.itemId }, data: updateData });

      auditData.push({
        userId: session.user.id, entityType: "ORDER_ITEM", entityId: m.itemId,
        orderItemId: m.itemId, action: "UPDATE", fieldName: "productionOrderNo",
        oldValue: m.oldPO, newValue: m.newPO, source: "EXCEL_IMPORT",
      });
      for (const c of m.stageChanges) {
        auditData.push({
          userId: session.user.id, entityType: "ORDER_ITEM", entityId: m.itemId,
          orderItemId: m.itemId, action: "UPDATE", fieldName: c.field,
          oldValue: c.old, newValue: c.newVal, source: "EXCEL_IMPORT",
        });
      }
    }

    if (auditData.length > 0) await tx.auditLog.createMany({ data: auditData });
  }, { timeout: 30000 });

  return Response.json({ updated: matches.length, notFound: notFound.length });
  } catch (err) {
    console.error("[import/inventory-update]", err);
    return Response.json({ errors: [`Server error: ${err instanceof Error ? err.message : String(err)}`], preview: null }, { status: 500 });
  }
}
