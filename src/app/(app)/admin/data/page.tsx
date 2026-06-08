import { prisma } from "@/lib/prisma";
import { AdminDataClient } from "./admin-data-client";

export default async function AdminDataPage() {
  const orders = await prisma.salesOrder.findMany({
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { purchaseReqs: { select: { material: true, status: true } } },
      },
    },
    orderBy: { rsd: "asc" },
  });
  return <AdminDataClient orders={orders} />;
}
