import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePlannerFile } from "@/lib/excel";
import { findMatchingItem } from "@/lib/order-item-match";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });
  if (!["ADMIN", "GM", "PLANNER"].includes(session.user.role)) return new Response(null, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors } = parsePlannerFile(buffer);

  if (errors.length) return Response.json({ errors, preview: [], rows: [] });
  if (rows.length === 0) return Response.json({ errors: ["No data rows found"], preview: [], rows: [] });

  const ppNumbers = [...new Set(rows.map(r => r.ppoNumber))];
  const existingOrders = await prisma.salesOrder.findMany({
    where: { ppoNumber: { in: ppNumbers } },
    include: { items: true },
  });
  const orderMap = new Map(existingOrders.map(o => [o.ppoNumber, o]));

  const preview = rows.map(row => {
    const order = orderMap.get(row.ppoNumber);
    const item = order ? findMatchingItem(order.items, row) : undefined;
    const changes: string[] = [];
    if (item) {
      const fields: [string, string][] = [
        ["drawingStatus","Drawing"],["carpentryStatus","Carpentry"],
        ["paintingStatus","Painting"],["upholsteryStatus","Upholstery"],["packingStatus","Packing"],
      ];
      for (const [f, label] of fields) {
        const newVal = row[f as keyof typeof row];
        if (newVal && newVal !== item[f as keyof typeof item]) {
          changes.push(`${label}: ${item[f as keyof typeof item]} → ${newVal}`);
        }
      }
      if (row.productionOrderNo !== undefined && row.productionOrderNo !== item.productionOrderNo) {
        changes.push(`Production Order No: ${item.productionOrderNo || "(empty)"} → ${row.productionOrderNo}`);
      }
    }
    return {
      ppoNumber: row.ppoNumber, itemCode: row.itemCode, description: row.description,
      isNewOrder: !order, isNewItem: !item,
      affectsCount: item ? 1 : 0, changes,
    };
  });

  return Response.json({ preview, errors, rows });
}
