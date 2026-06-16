"use client";

import { useState } from "react";
import { StageCell } from "@/components/items/stage-cell";
import { ItemDetailsSheet } from "@/components/items/item-details-sheet";
import { ProductionOrderCell } from "@/components/items/production-order-cell";
import { format } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { MessageSquare, ShoppingCart, PackageCheck, PackageMinus, Ban } from "lucide-react";
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
  if (role === "PLANNER" && PLANNER_DEPTS.includes(stageDept)) return true;
  if (role === "TECHNICAL" && stageDept === "DRAWING") return true;
  return false;
}

type PR = { material: string; status: string };
type ItemWithPRs = OrderItem & { purchaseReqs: PR[] };

interface Props {
  order: SalesOrder & { items: ItemWithPRs[] };
  role: Role;
  department: Department | null;
  userId: string;
}

export function OrderDetailClient({ order, role, department, userId }: Props) {
  const [items, setItems] = useState(order.items);
  const [selectedItem, setSelectedItem] = useState<ItemWithPRs | null>(null);

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
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Item</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Prod. Order No</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Description</th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Qty</th>
              {STAGES.map(s => (
                <th key={s.key} className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">{s.label}</th>
              ))}
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-medium">Delay</th>
              {/* PR summary columns */}
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 px-3 py-3" title="Materials requested by Technical">
                <ShoppingCart className="h-3.5 w-3.5 text-amber-500 mx-auto" />
              </th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 px-3 py-3" title="Materials arrived (Procurement)">
                <PackageCheck className="h-3.5 w-3.5 text-green-500 mx-auto" />
              </th>
              <th className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => {
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
                  {/* Required symbol */}
                  <td className="px-3 py-3 text-center">
                    {!item.requiresMaterial
                      ? <span title="N/A — item needs no material"><Ban className="h-4 w-4 text-red-400 mx-auto" /></span>
                      : hasRequired
                        ? <ShoppingCart className="h-4 w-4 text-amber-500 mx-auto" />
                        : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  {/* Arrived symbol — full / partial / none */}
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
