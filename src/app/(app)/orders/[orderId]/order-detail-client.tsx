"use client";

import { useState, useMemo } from "react";
import { StageCell } from "@/components/items/stage-cell";
import { ItemDetailsSheet } from "@/components/items/item-details-sheet";
import { ProductionOrderCell } from "@/components/items/production-order-cell";
import { format } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShoppingCart, PackageCheck, PackageMinus, Ban, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import type { Role, Department, StageStatus, SalesOrder, OrderItem } from "@/generated/prisma/client";

const STAGES = [
  { key: "drawing",    label: "Drawing",    dept: "DRAWING" },
  { key: "carpentry",  label: "Carpentry",  dept: "CARPENTRY" },
  { key: "painting",   label: "Painting",   dept: "PAINTING" },
  { key: "upholstery", label: "Upholstery", dept: "UPHOLSTERY" },
  { key: "packing",    label: "Packing",    dept: "PACKING" },
] as const;

const PLANNER_DEPTS = ["CARPENTRY", "PAINTING", "UPHOLSTERY", "PACKING"];

function canEditStage(role: Role, department: Department | null, stageDept: string): boolean {
  if (role === "ADMIN") return true;
  if (role === "PRODUCTION" && department === stageDept) return true;
  if ((role === "PLANNER" || role === "GM" || role === "BD") && PLANNER_DEPTS.includes(stageDept)) return true;
  if (role === "TECHNICAL" && stageDept === "DRAWING") return true;
  return false;
}

type SortKey =
  | "itemCode" | "productionOrderNo" | "description" | "outstandingQty"
  | "drawingStatus" | "carpentryStatus" | "paintingStatus" | "upholsteryStatus" | "packingStatus"
  | "reasonOfDelay" | "materialsRequested" | "materialsArrived";
type SortDir = "asc" | "desc";

type PR = { material: string; status: string };
type ItemWithPRs = OrderItem & { purchaseReqs: PR[] };

interface Props {
  order: SalesOrder & { items: ItemWithPRs[] };
  role: Role;
  department: Department | null;
  userId: string;
}

const STATUS_ORDER: Record<string, number> = { PENDING: 0, IN_PROGRESS: 1, DONE: 2, NA: 3 };

function getSortValue(item: ItemWithPRs, key: SortKey): string | number {
  switch (key) {
    case "itemCode":          return (item.itemCode ?? "").toLowerCase();
    case "productionOrderNo": return (item.productionOrderNo ?? "").toLowerCase();
    case "description":       return (item.description ?? "").toLowerCase();
    case "outstandingQty":    return item.outstandingQty ?? 0;
    case "drawingStatus":     return STATUS_ORDER[item.drawingStatus] ?? 0;
    case "carpentryStatus":   return STATUS_ORDER[item.carpentryStatus] ?? 0;
    case "paintingStatus":    return STATUS_ORDER[item.paintingStatus] ?? 0;
    case "upholsteryStatus":  return STATUS_ORDER[item.upholsteryStatus] ?? 0;
    case "packingStatus":     return STATUS_ORDER[item.packingStatus] ?? 0;
    case "reasonOfDelay":     return (item.reasonOfDelay ?? "").toLowerCase();
    case "materialsRequested": {
      if (!item.requiresMaterial) return 2;
      const active = item.purchaseReqs.filter(p => p.status !== "CANCELLED");
      return active.length > 0 ? 1 : 0;
    }
    case "materialsArrived": {
      if (!item.requiresMaterial) return 3;
      const active = item.purchaseReqs.filter(p => p.status !== "CANCELLED");
      if (active.length === 0) return 0;
      const arrived = active.filter(p => p.status === "RECEIVED").length;
      if (arrived === active.length) return 2;
      return arrived > 0 ? 1 : 0;
    }
    default: return "";
  }
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400 inline-block shrink-0" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1 text-blue-500 inline-block shrink-0" />
    : <ChevronDown className="h-3 w-3 ml-1 text-blue-500 inline-block shrink-0" />;
}

function SortTh({ col, label, sortKey, sortDir, onSort, className }: {
  col: SortKey; label: string; sortKey: SortKey | null; sortDir: SortDir;
  onSort: (col: SortKey) => void; className?: string;
}) {
  return (
    <th className={`lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium ${className ?? ""}`}>
      <button onClick={() => onSort(col)} className="flex items-center hover:text-blue-600 transition-colors whitespace-nowrap">
        {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </button>
    </th>
  );
}

export function OrderDetailClient({ order, role, department, userId }: Props) {
  const [items, setItems] = useState(order.items);
  const [selectedItem, setSelectedItem] = useState<ItemWithPRs | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortKey, sortDir]);

  function handleStageUpdate(itemId: string, stage: string, newStatus: StageStatus, newVersion: number, updatedItem?: Partial<OrderItem>) {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, ...(updatedItem ?? { [`${stage}Status`]: newStatus, version: newVersion }) }
        : item
    ));
  }

  function handlePRsChange(itemId: string, prs: PR[]) {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, purchaseReqs: prs } : item
    ));
  }

  function handleRequiresMaterialChange(itemId: string, value: boolean) {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, requiresMaterial: value } : item
    ));
  }

  return (
    <div className="space-y-6">
      <div className="lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:flex lg:flex-col lg:justify-center lg:border-b lg:border-gray-200">
        <h1 className="text-2xl font-semibold">{order.ppoNumber}</h1>
        <p className="text-muted-foreground">{order.clientName} · RSD: {format(order.rsd)}</p>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto lg:overflow-visible lg:isolate">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead className="bg-gray-50 border-b">
            <tr>
              <SortTh col="itemCode"          label="Item"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh col="productionOrderNo" label="Prod. Order No" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh col="description"       label="Description"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh col="outstandingQty"    label="Qty"           sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              {STAGES.map(s => (
                <SortTh
                  key={s.key}
                  col={`${s.key}Status` as SortKey}
                  label={s.label}
                  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
                />
              ))}
              <SortTh col="reasonOfDelay"      label="Delay"        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              {/* PR icon columns */}
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 px-3 py-3">
                <button onClick={() => toggleSort("materialsRequested")} className="block mx-auto" title="Sort by materials requested">
                  <ShoppingCart className={`h-3.5 w-3.5 mx-auto ${sortKey === "materialsRequested" ? "text-blue-500" : "text-amber-500"}`} />
                </button>
              </th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 px-3 py-3">
                <button onClick={() => toggleSort("materialsArrived")} className="block mx-auto" title="Sort by materials arrived">
                  <PackageCheck className={`h-3.5 w-3.5 mx-auto ${sortKey === "materialsArrived" ? "text-blue-500" : "text-green-500"}`} />
                </button>
              </th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedItems.map(item => {
              const active = item.purchaseReqs.filter(p => p.status !== "CANCELLED");
              const hasRequired = active.length > 0;
              const arrivedCount = active.filter(p => p.status === "RECEIVED").length;
              const allArrived = hasRequired && arrivedCount === active.length;
              const someArrived = hasRequired && arrivedCount > 0 && !allArrived;
              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono">{item.itemCode}</td>
                  <td className="px-4 py-3"><ProductionOrderCell value={item.productionOrderNo} /></td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3">{item.outstandingQty}</td>
                  {STAGES.map(s => {
                    const statusKey = `${s.key}Status` as keyof OrderItem;
                    return (
                      <td key={s.key} className="px-4 py-3">
                        <StageCell
                          itemId={item.id}
                          stage={s.key}
                          status={item[statusKey] as StageStatus}
                          version={item.version}
                          canEdit={canEditStage(role, department, s.dept)}
                          onUpdate={(newStatus, newVersion, updatedItem) =>
                            handleStageUpdate(item.id, s.key, newStatus, newVersion, updatedItem)
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-xs text-orange-600 max-w-[120px] truncate">
                    {item.reasonOfDelay ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {!item.requiresMaterial
                      ? <span title="N/A — item needs no material"><Ban className="h-4 w-4 text-red-400 mx-auto" /></span>
                      : hasRequired
                        ? <ShoppingCart className="h-4 w-4 text-amber-500 mx-auto" />
                        : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {!item.requiresMaterial
                      ? <span title="N/A — item needs no material"><Ban className="h-4 w-4 text-red-400 mx-auto" /></span>
                      : allArrived
                        ? <span title="All arrived"><PackageCheck className="h-4 w-4 text-green-500 mx-auto" /></span>
                        : someArrived
                          ? <span title={`${arrivedCount}/${active.length} arrived`}><PackageMinus className="h-4 w-4 text-orange-400 mx-auto" /></span>
                          : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedItem(item)} className="h-7 px-2">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedItem && (
        <ItemDetailsSheet
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          itemId={selectedItem.id}
          itemCode={selectedItem.itemCode}
          reasonOfDelay={selectedItem.reasonOfDelay}
          requiresMaterial={selectedItem.requiresMaterial}
          initialPRs={selectedItem.purchaseReqs}
          userId={userId}
          role={role}
          onPRsChange={(prs) => handlePRsChange(selectedItem.id, prs)}
          onRequiresMaterialChange={(value) => handleRequiresMaterialChange(selectedItem.id, value)}
        />
      )}
    </div>
  );
}
