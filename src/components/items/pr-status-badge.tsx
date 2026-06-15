import type { PRStatus } from "@/generated/prisma/client";

const ORDERED_STYLE = { label: "Ordered", className: "bg-orange-100 text-orange-700 border-orange-200" };

// DRAFT/SUBMITTED/APPROVED are legacy values from before the workflow was
// simplified to Ordered/Received — display them as "Ordered" if they're ever encountered.
const config: Record<PRStatus, { label: string; className: string }> = {
  DRAFT:     ORDERED_STYLE,
  SUBMITTED: ORDERED_STYLE,
  APPROVED:  ORDERED_STYLE,
  ORDERED:   ORDERED_STYLE,
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
