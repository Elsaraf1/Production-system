import { prisma } from "@/lib/prisma";
import { ProcurementClient } from "./procurement-client";

export default async function ProcurementPage() {
  const prs = await prisma.purchaseRequisition.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      orderItem: { include: { salesOrder: true } },
      createdBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = prs.map(pr => ({
    id: pr.id,
    ppoNumber:   pr.orderItem.salesOrder.ppoNumber,
    clientName:  pr.orderItem.salesOrder.clientName,
    rsd:         pr.orderItem.salesOrder.rsd.toISOString(),
    itemCode:    pr.orderItem.itemCode,
    material:    pr.material,
    status:      pr.status,
    requestedDate: pr.requestedDate?.toISOString() ?? null,
    receivedDate:  pr.receivedDate?.toISOString() ?? null,
    createdBy:   pr.createdBy.displayName,
  }));

  return <ProcurementClient rows={rows} />;
}
