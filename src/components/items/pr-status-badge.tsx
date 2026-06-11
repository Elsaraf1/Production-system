import type { PRStatus } from "@/generated/prisma/client";

const config: Record<PRStatus, { label: string; className: string }> = {
  DRAFT:     { label: "Draft",     className: "bg-gray-100 text-gray-600 border-gray-200" },
  SUBMITTED: { label: "Draft",     className: "bg-gray-100 text-gray-600 border-gray-200" },
  APPROVED:  { label: "Approved",  className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  ORDERED:   { label: "Ordered",   className: "bg-orange-100 text-orange-700 border-orange-200" },
  RECEIVED:  { label: "Received",  className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-600 border-red-200" },
};

export function PRStatusBadge({ status }: { status: PRStatus }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}
