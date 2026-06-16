import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { format } from "@/lib/date";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function OrdersPage({ searchParams }: Props) {
  const { q } = await searchParams;

  const orders = await prisma.salesOrder.findMany({
    where: q
      ? { OR: [
          { ppoNumber: { contains: q, mode: "insensitive" } },
          { clientName: { contains: q, mode: "insensitive" } },
        ] }
      : undefined,
    include: { _count: { select: { items: true } } },
    orderBy: { rsd: "asc" },
  });

  const now = new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:border-b lg:border-gray-200">
        <div>
          <h1 className="text-2xl font-semibold">Sales Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        </div>
        <form method="get" className="w-full sm:w-64">
          <Input name="q" defaultValue={q} placeholder="Search PPO or client…" className="h-9" />
        </form>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto lg:overflow-visible shadow-sm lg:isolate">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">PPO Number</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">Client</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">Order Date</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">RSD</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">Items</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const isOverdue = order.rsd < now;
              const isDueSoon = !isOverdue && order.rsd < new Date(now.getTime() + 7 * 86400000);
              return (
                <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/orders/${order.id}`} className="font-mono font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      {order.ppoNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{order.clientName}</td>
                  <td className="px-5 py-3.5 text-gray-500">{format(order.orderDate)}</td>
                  <td className="px-5 py-3.5">
                    <span className={isOverdue ? "text-red-600 font-medium" : isDueSoon ? "text-orange-600 font-medium" : "text-gray-500"}>
                      {format(order.rsd)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                      {order._count.items}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {isOverdue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">Overdue</span>
                    ) : isDueSoon ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">Due Soon</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">On Track</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
