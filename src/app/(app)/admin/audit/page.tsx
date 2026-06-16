import { prisma } from "@/lib/prisma";
import { format } from "@/lib/date";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:flex lg:items-center lg:border-b lg:border-gray-200">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
      </div>
      <div className="rounded-lg border bg-white overflow-x-auto lg:overflow-visible">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Time</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">User</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Action</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Entity</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Field</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">From</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">To</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries yet.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("en-GB")}
                </td>
                <td className="px-4 py-3">{log.user.displayName}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    log.action === "CREATE" ? "bg-green-100 text-green-700" :
                    log.action === "DELETE" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{log.action}</span>
                </td>
                <td className="px-4 py-3 text-xs">{log.entityType}</td>
                <td className="px-4 py-3 text-xs">{log.fieldName ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{log.oldValue ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{log.newValue ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{log.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
