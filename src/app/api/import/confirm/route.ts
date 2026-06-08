import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { NextRequest } from "next/server";
import type { ImportRow } from "@/lib/excel";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });

  const { rows }: { rows: ImportRow[] } = await req.json();
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

      // Upsert OrderItem
      const existing = await prisma.orderItem.findFirst({
        where: { salesOrderId: order.id, itemCode: row.itemCode },
      });

      if (!existing) {
        const item = await prisma.orderItem.create({
          data: {
            salesOrderId: order.id,
            itemCode: row.itemCode,
            description: row.description ?? "",
            productionOrderNo: row.productionOrderNo ?? "",
            outstandingQty: row.outstandingQty ?? 0,
            drawingStatus: (row.drawingStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            drawingDate: row.drawingDate ? new Date(row.drawingDate) : null,
            carpentryStatus: (row.carpentryStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            carpentryDate: row.carpentryDate ? new Date(row.carpentryDate) : null,
            paintingStatus: (row.paintingStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            paintingDate: row.paintingDate ? new Date(row.paintingDate) : null,
            upholsteryStatus: (row.upholsteryStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            upholsteryDate: row.upholsteryDate ? new Date(row.upholsteryDate) : null,
            packingStatus: (row.packingStatus as "PENDING" | "IN_PROGRESS" | "DONE" | "NA") ?? "PENDING",
            packingDate: row.packingDate ? new Date(row.packingDate) : null,
            reasonOfDelay: row.reasonOfDelay ?? null,
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
        const stageFields: Array<[string, string | undefined, string, string | undefined]> = [
          ["drawingStatus", row.drawingStatus, "drawingDate", row.drawingDate],
          ["carpentryStatus", row.carpentryStatus, "carpentryDate", row.carpentryDate],
          ["paintingStatus", row.paintingStatus, "paintingDate", row.paintingDate],
          ["upholsteryStatus", row.upholsteryStatus, "upholsteryDate", row.upholsteryDate],
          ["packingStatus", row.packingStatus, "packingDate", row.packingDate],
        ];
        const auditEntries: Array<{ field: string; old: string | null; newVal: string | null }> = [];

        for (const [statusField, newStatus, dateField, newDate] of stageFields) {
          if (newStatus && newStatus !== (existing as Record<string, unknown>)[statusField]) {
            auditEntries.push({ field: statusField, old: String((existing as Record<string, unknown>)[statusField] ?? ""), newVal: newStatus });
            updateData[statusField] = newStatus;
            if (newDate) updateData[dateField] = new Date(newDate);
          }
        }
        if (row.reasonOfDelay !== undefined && row.reasonOfDelay !== existing.reasonOfDelay) {
          updateData.reasonOfDelay = row.reasonOfDelay;
        }
        if (row.outstandingQty !== undefined) updateData.outstandingQty = row.outstandingQty;

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
}
