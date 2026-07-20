import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { findMatchingItem } from "@/lib/order-item-match";
import { NextRequest } from "next/server";
import type { PlannerRow } from "@/lib/excel";

export async function POST(req: NextRequest) {
  try {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "GM", "BD", "PLANNER"].includes(session.user.role)) return new Response(null, { status: 403 });

  const { rows }: { rows: PlannerRow[] } = await req.json();
  if (!rows?.length) return Response.json({ error: "No rows" }, { status: 400 });

  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    try {
      // Upsert SalesOrder
      let order = await prisma.salesOrder.findUnique({ where: { ppoNumber: row.ppoNumber } });
      if (!order) {
        order = await prisma.salesOrder.create({
          data: {
            ppoNumber: row.ppoNumber,
            clientName: row.clientName ?? row.ppoNumber,
            orderDate: row.orderDate ? new Date(row.orderDate) : new Date(),
            rsd: row.rsd ? new Date(row.rsd) : new Date(),
          },
        });
        await writeAuditLog(prisma as Parameters<typeof writeAuditLog>[0], {
          userId: session.user.id, entityType: "SALES_ORDER", entityId: order.id,
          action: "CREATE", source: "EXCEL_IMPORT", newValue: row.ppoNumber,
        });
      }

      // Upsert OrderItem — match by Production Order No when the row has a real
      // one (the true unique identifier per line); fall back to item code for
      // rows with no PO number yet. See findMatchingItem for details.
      const candidates = await prisma.orderItem.findMany({
        where: {
          salesOrderId: order.id,
          OR: [
            { itemCode: row.itemCode },
            ...(row.productionOrderNo ? [{ productionOrderNo: row.productionOrderNo }] : []),
          ],
        },
      });
      const existing = findMatchingItem(candidates, row);
      const isInventored = row.productionOrderNo?.trim().toLowerCase() === "inventored";

      if (!existing) {
        const item = await prisma.orderItem.create({
          data: {
            salesOrderId: order.id,
            itemCode: row.itemCode,
            description: row.description ?? "",
            productionOrderNo: row.productionOrderNo ?? "",
            outstandingQty: row.outstandingQty ?? 0,
            drawingStatus: (row.drawingStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            carpentryStatus: (row.carpentryStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            paintingStatus: (row.paintingStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            upholsteryStatus: (row.upholsteryStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            packingStatus: (row.packingStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            reasonOfDelay: row.reasonOfDelay ?? null,
            ...(isInventored ? {
              drawingDate: new Date(), carpentryDate: new Date(), paintingDate: new Date(),
              upholsteryDate: new Date(), packingDate: new Date(),
            } : {}),
          },
        });
        await writeAuditLog(prisma as Parameters<typeof writeAuditLog>[0], {
          userId: session.user.id, entityType: "ORDER_ITEM", entityId: item.id,
          orderItemId: item.id, action: "CREATE", source: "EXCEL_IMPORT",
          newValue: row.itemCode,
        });
        created++;
      } else {
        // Update only changed fields
        const updateData: Record<string, unknown> = {};
        const stageFields: Array<[string, string | undefined]> = [
          ["drawingStatus", row.drawingStatus],
          ["carpentryStatus", row.carpentryStatus],
          ["paintingStatus", row.paintingStatus],
          ["upholsteryStatus", row.upholsteryStatus],
          ["packingStatus", row.packingStatus],
        ];
        const auditEntries: Array<{ field: string; old: string | null; newVal: string | null }> = [];

        const dateFields: Record<string, string> = {
          drawingStatus: "drawingDate", carpentryStatus: "carpentryDate", paintingStatus: "paintingDate",
          upholsteryStatus: "upholsteryDate", packingStatus: "packingDate",
        };
        for (const [statusField, newStatus] of stageFields) {
          if (newStatus && newStatus !== (existing as Record<string, unknown>)[statusField]) {
            auditEntries.push({ field: statusField, old: String((existing as Record<string, unknown>)[statusField] ?? ""), newVal: newStatus });
            updateData[statusField] = newStatus;
            if (isInventored && newStatus === "DONE") updateData[dateFields[statusField]] = new Date();
          }
        }
        if (row.reasonOfDelay !== undefined && row.reasonOfDelay !== existing.reasonOfDelay) {
          updateData.reasonOfDelay = row.reasonOfDelay;
        }
        if (row.outstandingQty !== undefined) updateData.outstandingQty = row.outstandingQty;
        if (row.productionOrderNo !== undefined && row.productionOrderNo !== existing.productionOrderNo) {
          auditEntries.push({ field: "productionOrderNo", old: existing.productionOrderNo, newVal: row.productionOrderNo });
          updateData.productionOrderNo = row.productionOrderNo;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.$transaction(async (tx) => {
            await tx.orderItem.update({ where: { id: existing.id }, data: { ...updateData, version: { increment: 1 } } });
            for (const entry of auditEntries) {
              await writeAuditLog(tx, {
                userId: session.user.id, entityType: "ORDER_ITEM", entityId: existing.id,
                orderItemId: existing.id, action: "UPDATE", fieldName: entry.field,
                oldValue: entry.old, newValue: entry.newVal, source: "EXCEL_IMPORT",
              });
            }
          });
          updated++;
        } else {
          skipped++;
        }
      }
    } catch {
      skipped++;
    }
  }

  return Response.json({ created, updated, skipped });
  } catch (err) {
    console.error("[import/confirm]", err);
    return Response.json({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
