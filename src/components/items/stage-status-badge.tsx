import type { StageStatus } from "@/generated/prisma";

const config: Record<StageStatus, { label: string; className: string }> = {
  PENDING:     { label: "Pending",     className: "bg-gray-100 text-gray-500 border-gray-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
  DONE:        { label: "Done",        className: "bg-green-100 text-green-700 border-green-200" },
  NA:          { label: "N/A",         className: "bg-zinc-100 text-zinc-400 border-zinc-200" },
};

export function StageStatusBadge({ status }: { status: StageStatus }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}
