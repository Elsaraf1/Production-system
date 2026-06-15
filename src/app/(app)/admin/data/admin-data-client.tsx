"use client";

import { useState, useTransition, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ProductionOrderCell } from "@/components/items/production-order-cell";
import { Trash2, Pencil, ChevronDown, ChevronRight, Plus, ShoppingCart, PackageCheck, PackageMinus, Ban } from "lucide-react";
import { format } from "@/lib/date";
import type { SalesOrder, OrderItem } from "@/generated/prisma/client";

type PR = { material: string; status: string };
type ItemWithPRs = OrderItem & { purchaseReqs: PR[] };
type OrderWithItems = SalesOrder & { items: ItemWithPRs[] };

const STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "NA"] as const;
const STAGES = [
  { key: "drawingStatus",    label: "Drawing" },
  { key: "carpentryStatus",  label: "Carpentry" },
  { key: "paintingStatus",   label: "Painting" },
  { key: "upholsteryStatus", label: "Upholstery" },
  { key: "packingStatus",    label: "Packing" },
] as const;

const statusColor: Record<string, string> = {
  PENDING:     "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE:        "bg-green-100 text-green-700",
  NA:          "bg-zinc-100 text-zinc-500",
};

interface EditItemForm {
  description: string; productionOrderNo: string; outstandingQty: number;
  drawingStatus: string; carpentryStatus: string; paintingStatus: string;
  upholsteryStatus: string; packingStatus: string; reasonOfDelay: string;
}
interface EditOrderForm { clientName: string; ppoNumber: string; orderDate: string; rsd: string; }
interface AddItemForm {
  itemCode: string; description: string; productionOrderNo: string; outstandingQty: number;
  drawingStatus: string; carpentryStatus: string; paintingStatus: string;
  upholsteryStatus: string; packingStatus: string;
}

const defaultAddItem: AddItemForm = {
  itemCode: "", description: "", productionOrderNo: "", outstandingQty: 0,
  drawingStatus: "PENDING", carpentryStatus: "PENDING", paintingStatus: "PENDING",
  upholsteryStatus: "PENDING", packingStatus: "PENDING",
};

export function AdminDataClient({ orders: initial }: { orders: OrderWithItems[] }) {
  const [orders, setOrders] = useState(initial);
  // All groups collapsed by default
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(initial.map(o => o.id)));
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<OrderItem | null>(null);
  const [editItemForm, setEditItemForm] = useState<EditItemForm | null>(null);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [editOrderForm, setEditOrderForm] = useState<EditOrderForm | null>(null);
  const [addToOrder, setAddToOrder] = useState<SalesOrder | null>(null);
  const [addItemForm, setAddItemForm] = useState<AddItemForm>(defaultAddItem);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "item" | "order"; id: string; label: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const q = search.toLowerCase();
  const filtered = orders.filter(o => {
    if (!q) return true;
    if (o.ppoNumber.toLowerCase().includes(q)) return true;
    if (o.clientName.toLowerCase().includes(q)) return true;
    // Also match if any item code contains the search
    if (o.items.some(i => i.itemCode.toLowerCase().includes(q))) return true;
    return false;
  });

  // When searching by item code, auto-expand matched orders
  const expandedBySearch = q
    ? new Set(filtered.filter(o => o.items.some(i => i.itemCode.toLowerCase().includes(q))).map(o => o.id))
    : new Set<string>();

  function isCollapsed(orderId: string) {
    if (expandedBySearch.has(orderId)) return false;
    return collapsed.has(orderId);
  }

  function toggleCollapse(orderId: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  }

  // ── Edit item ──
  function openEditItem(item: OrderItem) {
    setEditItem(item);
    setEditItemForm({
      description: item.description, productionOrderNo: item.productionOrderNo,
      outstandingQty: item.outstandingQty, drawingStatus: item.drawingStatus,
      carpentryStatus: item.carpentryStatus, paintingStatus: item.paintingStatus,
      upholsteryStatus: item.upholsteryStatus, packingStatus: item.packingStatus,
      reasonOfDelay: item.reasonOfDelay ?? "",
    });
  }

  async function saveEditItem() {
    if (!editItem || !editItemForm) return;
    startTransition(async () => {
      const res = await fetch(`/api/items/${editItem.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editItemForm, reasonOfDelay: editItemForm.reasonOfDelay || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders(prev => prev.map(o => ({ ...o, items: o.items.map(i => i.id === updated.id ? updated : i) })));
        setEditItem(null); setEditItemForm(null);
      }
    });
  }

  // ── Edit order ──
  function openEditOrder(order: SalesOrder) {
    setEditOrder(order);
    setEditOrderForm({
      clientName: order.clientName, ppoNumber: order.ppoNumber,
      orderDate: new Date(order.orderDate).toISOString().split("T")[0],
      rsd: new Date(order.rsd).toISOString().split("T")[0],
    });
  }

  async function saveEditOrder() {
    if (!editOrder || !editOrderForm) return;
    startTransition(async () => {
      const res = await fetch(`/api/orders/${editOrder.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editOrderForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
        setEditOrder(null); setEditOrderForm(null);
      }
    });
  }

  // ── Add item ──
  async function saveAddItem() {
    if (!addToOrder) return;
    startTransition(async () => {
      const res = await fetch(`/api/orders/${addToOrder.id}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addItemForm),
      });
      if (res.ok) {
        const newItem = await res.json();
        setOrders(prev => prev.map(o =>
          o.id === addToOrder.id ? { ...o, items: [...o.items, { ...newItem, purchaseReqs: [] }] } : o
        ));
        // Expand the order so the new item is visible
        setCollapsed(prev => { const next = new Set(prev); next.delete(addToOrder.id); return next; });
        setAddToOrder(null); setAddItemForm(defaultAddItem);
      }
    });
  }

  // ── Delete ──
  async function deleteItem(itemId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setOrders(prev => prev.map(o => ({ ...o, items: o.items.filter(i => i.id !== itemId) })));
        setConfirmDelete(null);
      }
    });
  }

  async function deleteOrder(orderId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) { setOrders(prev => prev.filter(o => o.id !== orderId)); setConfirmDelete(null); }
    });
  }

  const totalItems = filtered.reduce((sum, o) => sum + o.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Data Management</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} orders · {totalItems} items</p>
        </div>
        <Input
          placeholder="Search PPO, client or item code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto lg:overflow-visible">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 w-8 px-3 py-2.5" />
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 text-left px-3 py-2.5 font-medium">Item Code</th>
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 text-left px-3 py-2.5 font-medium">Prod. Order</th>
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 text-left px-3 py-2.5 font-medium">Description</th>
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 text-left px-3 py-2.5 font-medium">Qty</th>
              {STAGES.map(s => <th key={s.key} className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 text-left px-3 py-2.5 font-medium">{s.label}</th>)}
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 text-left px-3 py-2.5 font-medium">Delay</th>
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 px-2 py-2.5 text-center" title="Required"><ShoppingCart className="h-3.5 w-3.5 text-amber-500 mx-auto" /></th>
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 px-2 py-2.5 text-center" title="Arrived"><PackageCheck className="h-3.5 w-3.5 text-green-500 mx-auto" /></th>
              <th className="lg:sticky lg:top-0 lg:z-10 bg-gray-50 px-3 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const collapsed_ = isCollapsed(order.id);
              const isOverdue = order.rsd < new Date();
              return (
                <Fragment key={order.id}>
                  {/* ── Order header ── */}
                  <tr key={`hdr-${order.id}`} className="bg-gray-50 border-y border-gray-200">
                    <td className="px-3 py-2">
                      <button onClick={() => toggleCollapse(order.id)} className="text-muted-foreground hover:text-foreground">
                        {collapsed_ ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                    <td colSpan={8} className="px-3 py-2">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-semibold">{order.ppoNumber}</span>
                        <span className="text-muted-foreground">{order.clientName}</span>
                        <span className={`text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>RSD: {format(order.rsd)}</span>
                        <span className="text-xs text-muted-foreground">{order.items.length} items</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => { setAddToOrder(order); setAddItemForm(defaultAddItem); }}
                          className="text-muted-foreground hover:text-green-600 transition-colors" title="Add item">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEditOrder(order)}
                          className="text-muted-foreground hover:text-blue-600 transition-colors" title="Edit order">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setConfirmDelete({ type: "order", id: order.id, label: order.ppoNumber })}
                          className="text-muted-foreground hover:text-red-500 transition-colors" title="Delete order">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* ── Item rows ── */}
                  {!collapsed_ && order.items.map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 font-mono text-xs">{item.itemCode}</td>
                      <td className="px-3 py-2"><ProductionOrderCell value={item.productionOrderNo} /></td>
                      <td className="px-3 py-2 max-w-[180px] truncate">{item.description}</td>
                      <td className="px-3 py-2">{item.outstandingQty}</td>
                      {STAGES.map(s => (
                        <td key={s.key} className="px-3 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor[item[s.key as keyof OrderItem] as string]}`}>
                            {(item[s.key as keyof OrderItem] as string).replace("_", " ")}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-xs text-orange-600 max-w-[100px] truncate">{item.reasonOfDelay || "—"}</td>
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          if (!item.requiresMaterial) return <span title="N/A — item needs no material"><Ban className="h-3.5 w-3.5 text-red-400 mx-auto" /></span>;
                          const active = item.purchaseReqs.filter(p => p.status !== "CANCELLED");
                          return active.length > 0
                            ? <ShoppingCart className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                            : <span className="text-gray-300 text-xs">—</span>;
                        })()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          if (!item.requiresMaterial) return <span title="N/A — item needs no material"><Ban className="h-3.5 w-3.5 text-red-400 mx-auto" /></span>;
                          const active = item.purchaseReqs.filter(p => p.status !== "CANCELLED");
                          if (active.length === 0) return <span className="text-gray-300 text-xs">—</span>;
                          const arrived = active.filter(p => p.status === "RECEIVED").length;
                          if (arrived === active.length) return <span title="All arrived"><PackageCheck className="h-3.5 w-3.5 text-green-500 mx-auto" /></span>;
                          if (arrived > 0) return <span title={`${arrived}/${active.length} arrived`}><PackageMinus className="h-3.5 w-3.5 text-orange-400 mx-auto" /></span>;
                          return <span className="text-gray-300 text-xs">—</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => openEditItem(item)}
                            className="text-muted-foreground hover:text-blue-600 transition-colors" title="Edit item">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete({ type: "item", id: item.id, label: item.itemCode })}
                            className="text-muted-foreground hover:text-red-500 transition-colors" title="Delete item">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">No orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit Item Dialog ── */}
      <Dialog open={!!editItem} onOpenChange={() => { setEditItem(null); setEditItemForm(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Item: {editItem?.itemCode}</DialogTitle></DialogHeader>
          {editItemForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-y-auto">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={editItemForm.description} onChange={e => setEditItemForm(f => f && ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Production Order No</Label>
                <Input value={editItemForm.productionOrderNo} onChange={e => setEditItemForm(f => f && ({ ...f, productionOrderNo: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outstanding Qty</Label>
                <Input type="number" step="0.01" value={editItemForm.outstandingQty} onChange={e => setEditItemForm(f => f && ({ ...f, outstandingQty: Number(e.target.value) }))} />
              </div>
              {STAGES.map(s => (
                <div key={s.key} className="space-y-1">
                  <Label className="text-xs">{s.label}</Label>
                  <Select value={editItemForm[s.key as keyof EditItemForm] as string} onValueChange={v => setEditItemForm(f => f && ({ ...f, [s.key]: v ?? "" }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(st => <SelectItem key={st} value={st}>{st.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Reason of Delay</Label>
                <Input value={editItemForm.reasonOfDelay} onChange={e => setEditItemForm(f => f && ({ ...f, reasonOfDelay: e.target.value }))} placeholder="Leave blank to clear" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setEditItemForm(null); }}>Cancel</Button>
            <Button onClick={saveEditItem} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Order Dialog ── */}
      <Dialog open={!!editOrder} onOpenChange={() => { setEditOrder(null); setEditOrderForm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Order</DialogTitle></DialogHeader>
          {editOrderForm && (
            <div className="space-y-3 py-2">
              <div className="space-y-1"><Label className="text-xs">PPO Number</Label>
                <Input value={editOrderForm.ppoNumber} onChange={e => setEditOrderForm(f => f && ({ ...f, ppoNumber: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Client Name</Label>
                <Input value={editOrderForm.clientName} onChange={e => setEditOrderForm(f => f && ({ ...f, clientName: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Order Date</Label>
                <Input type="date" value={editOrderForm.orderDate} onChange={e => setEditOrderForm(f => f && ({ ...f, orderDate: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">RSD</Label>
                <Input type="date" value={editOrderForm.rsd} onChange={e => setEditOrderForm(f => f && ({ ...f, rsd: e.target.value }))} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOrder(null); setEditOrderForm(null); }}>Cancel</Button>
            <Button onClick={saveEditOrder} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Item Dialog ── */}
      <Dialog open={!!addToOrder} onOpenChange={() => { setAddToOrder(null); setAddItemForm(defaultAddItem); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Item to {addToOrder?.ppoNumber}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1">
              <Label className="text-xs">Item Code <span className="text-red-500">*</span></Label>
              <Input value={addItemForm.itemCode} onChange={e => setAddItemForm(f => ({ ...f, itemCode: e.target.value }))} placeholder="e.g. CHR-001" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Production Order No</Label>
              <Input value={addItemForm.productionOrderNo} onChange={e => setAddItemForm(f => ({ ...f, productionOrderNo: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={addItemForm.description} onChange={e => setAddItemForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Outstanding Qty</Label>
              <Input type="number" step="0.01" value={addItemForm.outstandingQty} onChange={e => setAddItemForm(f => ({ ...f, outstandingQty: Number(e.target.value) }))} />
            </div>
            {STAGES.map(s => (
              <div key={s.key} className="space-y-1">
                <Label className="text-xs">{s.label}</Label>
                <Select value={addItemForm[s.key as keyof AddItemForm] as string} onValueChange={v => setAddItemForm(f => ({ ...f, [s.key]: v ?? "" }))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(st => <SelectItem key={st} value={st}>{st.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddToOrder(null); setAddItemForm(defaultAddItem); }}>Cancel</Button>
            <Button onClick={saveAddItem} disabled={isPending || !addItemForm.itemCode.trim()}>{isPending ? "Adding…" : "Add Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDelete?.type === "order"
              ? `Delete order "${confirmDelete.label}" and ALL its items? This cannot be undone.`
              : `Delete item "${confirmDelete?.label}"? This cannot be undone.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={isPending}
              onClick={() => confirmDelete && (confirmDelete.type === "order" ? deleteOrder(confirmDelete.id) : deleteItem(confirmDelete.id))}>
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
