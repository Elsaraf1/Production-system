import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { format } from "@/lib/date";
import { OrderDetailClient } from "./order-detail-client";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const session = await auth();
  if (!session) return null;

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          purchaseReqs: { select: { material: true, status: true } },
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <OrderDetailClient
      order={order}
      role={session.user.role}
      department={session.user.department}
      userId={session.user.id}
    />
  );
}
