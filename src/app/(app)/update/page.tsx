import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StageStatusBadge } from "@/components/items/stage-status-badge";
import Link from "next/link";
import type { StageStatus } from "@/generated/prisma/client";

const deptStageMap: Record<string, { statusField: string; label: string }> = {
  DRAWING:    { statusField: "drawingStatus",    label: "Drawing" },
  CARPENTRY:  { statusField: "carpentryStatus",  label: "Carpentry" },
  PAINTING:   { statusField: "paintingStatus",   label: "Painting" },
  UPHOLSTERY: { statusField: "upholsteryStatus", label: "Upholstery" },
  PACKING:    { statusField: "packingStatus",    label: "Packing" },
};

export default async function UpdatePage() {
  const session = await auth();
  if (!session) return null;

  const { role, department } = session.user;

  const stageConfig = department ? deptStageMap[department] : null;

  const items = await prisma.orderItem.findMany({
    where: stageConfig
      ? { [stageConfig.statusField]: { in: ["PENDING", "IN_PROGRESS"] } }
      : { OR: [{ drawingStatus: { in: ["PENDING", "IN_PROGRESS"] } }, { carpentryStatus: { in: ["PENDING", "IN_PROGRESS"] } }, { paintingStatus: { in: ["PENDING", "IN_PROGRESS"] } }, { upholsteryStatus: { in: ["PENDING", "IN_PROGRESS"] } }, { packingStatus: { in: ["PENDING", "IN_PROGRESS"] } }] },
    include: { salesOrder: true },
    orderBy: [{ salesOrder: { rsd: "asc" } }, { sortOrder: "asc" }],
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Update</h1>
        <p className="text-muted-foreground text-sm">
          {stageConfig ? `Showing pending/in-progress items for ${stageConfig.label}` : "All pending/in-progress items"}
        </p>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">PPO</th>
              <th className="text-left px-4 py-3 font-medium">Item</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-left px-4 py-3 font-medium">RSD</th>
              {stageConfig ? (
                <th className="text-left px-4 py-3 font-medium">{stageConfig.label}</th>
              ) : (
                ["Drawing","Carpentry","Painting","Upholstery","Packing"].map(s => (
                  <th key={s} className="text-left px-4 py-3 font-medium">{s}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No pending items.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/orders/${item.salesOrderId}`} className="text-primary hover:underline font-medium">
                    {item.salesOrder.ppoNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono">{item.itemCode}</td>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-sm">{new Date(item.salesOrder.rsd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                {stageConfig ? (
                  <td className="px-4 py-3">
                    <StageStatusBadge status={item[stageConfig.statusField as keyof typeof item] as StageStatus} />
                  </td>
                ) : (
                  ["drawingStatus","carpentryStatus","paintingStatus","upholsteryStatus","packingStatus"].map(f => (
                    <td key={f} className="px-4 py-3">
                      <StageStatusBadge status={item[f as keyof typeof item] as StageStatus} />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
