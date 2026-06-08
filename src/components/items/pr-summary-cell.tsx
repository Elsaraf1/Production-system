import { ShoppingCart, PackageCheck } from "lucide-react";

interface PR { material: string; status: string; }

interface Props { prs: PR[]; }

export function PrSummaryCell({ prs }: Props) {
  const active = prs.filter(p => p.status !== "CANCELLED");
  const hasRequired = active.length > 0;
  const hasArrived = active.some(p => p.status === "RECEIVED");

  if (!hasRequired) {
    return (
      <div className="flex gap-2">
        <span className="text-xs text-gray-300">—</span>
        <span className="text-xs text-gray-300">—</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <ShoppingCart className="h-4 w-4 text-amber-500" title="Materials requested" />
      {hasArrived
        ? <PackageCheck className="h-4 w-4 text-green-500" title="Some materials arrived" />
        : <span className="text-gray-200"><PackageCheck className="h-4 w-4" /></span>
      }
    </div>
  );
}
