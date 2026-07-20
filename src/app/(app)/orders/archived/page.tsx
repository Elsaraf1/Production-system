import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { format } from "@/lib/date";
import { UnarchiveRowAction } from "./archived-row-action";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

function completedOn(items: { drawingDate: Date | null; carpentryDate: Date | null; paintingDate: Date | null; upholsteryDate: Date | null; packingDate: Date | null }[]): Date | null {
  let latest: Date | null = null;
  for (const item of items) {
    for (const d of [item.drawingDate, item.carpentryDate, item.paintingDate, item.upholsteryDate, item.packingDate]) {
      if (d && (!latest || d > latest)) latest = d;
    }
  }
  return latest;
}

export default async function ArchivedOrdersPage({ searchParams }: Props) {
  const [session, { q }] = await Promise.all([auth(), searchParams]);

  const orders = await prisma.salesOrder.findMany({
    where: {
      archivedAt: { not: null },
      ...(q ? { OR: [
        { ppoNumber: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    include: {
      items: { select: { drawingDate: true, carpentryDate: true, paintingDate: true, upholsteryDate: true, packingDate: true } },
    },
    orderBy: { archivedAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:border-b lg:border-gray-200">
        <div>
          <h1 className="text-2xl font-semibold">Archived Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <form method="get" className="w-full sm:w-64">
            <Input name="q" defaultValue={q} placeholder="Search PPO or client…" className="h-9" />
          </form>
          <Link href="/orders" className="text-sm text-primary hover:underline whitespace-nowrap">Back to Orders</Link>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto lg:overflow-visible shadow-sm lg:isolate">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">PPO Number</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">Client</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">RSD</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">Items</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600">Completed On</th>
              {session?.user.role === "ADMIN" && (
                <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-5 py-3 font-semibold text-gray-600" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                  No archived orders yet.
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const completed = completedOn(order.items);
              return (
                <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/orders/${order.id}`} className="font-mono font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      {order.ppoNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{order.clientName}</td>
                  <td className="px-5 py-3.5 text-gray-500">{format(order.rsd)}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                      {order.items.length}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{completed ? format(completed) : "—"}</td>
                  {session?.user.role === "ADMIN" && (
                    <td className="px-5 py-3.5">
                      <UnarchiveRowAction orderId={order.id} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
