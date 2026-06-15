import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { StageChart } from "./stage-chart";
import { DepartmentTimeChart } from "./department-time-chart";
import { getAverageStageDurations, getAverageOrderLeadTime } from "@/lib/department-stats";
import { format } from "@/lib/date";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);

  const [totalOrders, totalItems, overdueOrders, completedItems, dueSoon7] = await Promise.all([
    prisma.salesOrder.count(),
    prisma.orderItem.count(),
    prisma.salesOrder.findMany({
      where: { rsd: { lt: now } },
      select: { id: true, ppoNumber: true, clientName: true, rsd: true },
      orderBy: { rsd: "asc" },
    }),
    prisma.orderItem.count({ where: { packingStatus: "DONE" } }),
    prisma.salesOrder.count({ where: { rsd: { gte: now, lte: in7 } } }),
  ]);

  const stages = ["drawing", "carpentry", "painting", "upholstery", "packing"] as const;

  const [drawing, carpentry, painting, upholstery, packing] = await Promise.all(
    stages.map(stage =>
      prisma.orderItem.groupBy({
        by: [`${stage}Status` as "drawingStatus"],
        _count: { _all: true },
      })
    )
  );

  const [departmentDurations, orderLeadTime] = await Promise.all([
    getAverageStageDurations(),
    getAverageOrderLeadTime(),
  ]);
  const timeChartData = [orderLeadTime, ...departmentDurations];

  const chartData = [
    { name: "Drawing",    ...toMap(drawing,    "drawingStatus") },
    { name: "Carpentry",  ...toMap(carpentry,  "carpentryStatus") },
    { name: "Painting",   ...toMap(painting,   "paintingStatus") },
    { name: "Upholstery", ...toMap(upholstery, "upholsteryStatus") },
    { name: "Packing",    ...toMap(packing,    "packingStatus") },
  ];

  const kpis = [
    { label: "Total Orders",    value: totalOrders,          icon: Package,       color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "Total Items",     value: totalItems,           icon: Clock,         color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Overdue Orders",  value: overdueOrders.length, icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50" },
    { label: "Completed Items", value: completedItems,       icon: CheckCircle,   color: "text-green-600",  bg: "bg-green-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Production overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border bg-white p-5 shadow-sm flex items-center gap-4`}>
            <div className={`rounded-xl p-3 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              {label === "Overdue Orders" && dueSoon7 > 0 && (
                <p className="text-xs text-orange-500">{dueSoon7} due in 7d</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Stage Breakdown</CardTitle></CardHeader>
          <CardContent><StageChart data={chartData} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-600">⚠ Overdue Orders</CardTitle></CardHeader>
          <CardContent>
            {overdueOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue orders.</p>
            ) : (
              <div className="space-y-2">
                {overdueOrders.map(o => (
                  <div key={o.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                    <div>
                      <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.ppoNumber}</Link>
                      <p className="text-xs text-muted-foreground">{o.clientName}</p>
                    </div>
                    <span className="text-xs text-red-500">{format(o.rsd)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Average Time per Department (days)</CardTitle></CardHeader>
        <CardContent>
          <DepartmentTimeChart data={timeChartData} />
          <p className="text-xs text-muted-foreground mt-2">
            Order Lead Time: RSD minus Order Date (planned production window). Production stages: time from In Progress to Done. Procurement: time from material request to receipt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function toMap(rows: Array<Record<string, unknown>>, field: string) {
  const map = { PENDING: 0, IN_PROGRESS: 0, DONE: 0, NA: 0 };
  for (const row of rows) {
    const key = row[field] as keyof typeof map;
    map[key] = (row as { _count: { _all: number } })._count._all;
  }
  return map;
}
