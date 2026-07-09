import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPlannerSample, buildReleasingSample, buildMaterialSample, buildInventorySample } from "@/lib/excel";
import { NextRequest } from "next/server";

const staticConfigs = {
  planner:          { fn: buildPlannerSample,   name: "sample-planner-import.xlsx" },
  releasing:        { fn: buildReleasingSample, name: "sample-releasing-order.xlsx" },
  "material-request": { fn: buildMaterialSample, name: "sample-material-request.xlsx" },
  "material-receive": { fn: buildMaterialSample, name: "sample-material-receive.xlsx" },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response(null, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");

  let buffer: Buffer;
  let filename: string;

  if (type === "inventory-update") {
    if (!["ADMIN", "GM", "BD", "PLANNER"].includes(session.user.role)) return new Response(null, { status: 403 });

    const orders = await prisma.salesOrder.findMany({
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { ppoNumber: "asc" },
    });
    const items = orders.flatMap(o => o.items.map(i => ({
      itemId: i.id, ppoNumber: o.ppoNumber, itemCode: i.itemCode,
      description: i.description, productionOrderNo: i.productionOrderNo,
    })));

    buffer = buildInventorySample(items);
    filename = "inventory-update.xlsx";
  } else {
    const config = type ? staticConfigs[type as keyof typeof staticConfigs] : null;
    if (!config) return Response.json({ error: "Invalid type" }, { status: 400 });
    buffer = config.fn();
    filename = config.name;
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
