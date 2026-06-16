"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { PRStatusCell } from "@/components/items/pr-status-cell";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { PRStatus } from "@/generated/prisma/client";

interface PRRow {
  id: string;
  itemId: string;
  ppoNumber: string;
  clientName: string;
  rsd: string;
  itemCode: string;
  material: string;
  status: PRStatus;
  requestedDate: string | null;
  receivedDate: string | null;
  createdBy: string;
}

const statusStyle: Record<string, string> = {
  ORDERED:    "bg-orange-100 text-orange-700",
  RECEIVED:   "bg-green-100 text-green-700",
};

type SortKey = keyof PRRow;
type SortDir = "asc" | "desc";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const COLS: { key: SortKey; label: string; filterable?: boolean }[] = [
  { key: "ppoNumber",    label: "PPO Number",   filterable: true },
  { key: "clientName",   label: "Client",        filterable: true },
  { key: "rsd",          label: "RSD" },
  { key: "itemCode",     label: "Item Code",     filterable: true },
  { key: "material",     label: "Material",      filterable: true },
  { key: "status",       label: "Status",        filterable: true },
  { key: "requestedDate",label: "Ordered Date" },
  { key: "receivedDate", label: "Receive Date" },
  { key: "createdBy",    label: "Created By",    filterable: true },
];

export function ProcurementClient({ rows: initialRows, canEdit }: { rows: PRRow[]; canEdit: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [globalFilter, setGlobalFilter] = useState("");
  const [colFilters, setColFilters] = useState<Partial<Record<SortKey, string>>>({});
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set()); // empty = show all
  const [sortKey, setSortKey] = useState<SortKey>("rsd");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showColFilters, setShowColFilters] = useState(false);

  const presentStatuses = useMemo(
    () => [...new Set(rows.map(r => r.status))],
    [rows]
  );

  function toggleStatus(s: string) {
    setStatusFilter(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    let data = rows;
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      data = data.filter(r =>
        Object.values(r).some(v => String(v ?? "").toLowerCase().includes(q))
      );
    }
    if (statusFilter.size > 0) {
      data = data.filter(r => statusFilter.has(r.status));
    }
    for (const [k, v] of Object.entries(colFilters)) {
      if (!v) continue;
      const q = v.toLowerCase();
      data = data.filter(r => String(r[k as SortKey] ?? "").toLowerCase().includes(q));
    }
    return [...data].sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [rows, globalFilter, colFilters, statusFilter, sortKey, sortDir]);

  const pending = rows.filter(r => !["RECEIVED"].includes(r.status)).length;
  const received = rows.filter(r => r.status === "RECEIVED").length;

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 text-gray-300 inline ml-1" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-gray-600 inline ml-1" />
      : <ChevronDown className="h-3 w-3 text-gray-600 inline ml-1" />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:sticky lg:top-0 lg:z-20 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:border-b lg:border-gray-200">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Requisitions</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <span>{rows.length} total</span>
            <span className="text-orange-600 font-medium">{pending} pending</span>
            <span className="text-green-600 font-medium">{received} received</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search all…"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full sm:w-52 h-9"
          />
          <button
            onClick={() => setShowColFilters(v => !v)}
            className={`shrink-0 text-xs px-3 py-2 rounded-md border transition-colors ${showColFilters ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50"}`}
          >
            Column Filters
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto lg:overflow-visible">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead>
            <tr className="bg-gray-50 border-b">
              {COLS.map(col => (
                <th
                  key={col.key}
                  className="lg:sticky lg:z-10 lg:top-[68px] bg-gray-50 text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
            </tr>

            {/* Column filter row */}
            {showColFilters && (
              <tr className="border-b bg-gray-50/50">
                {COLS.map(col => (
                  <td key={col.key} className="px-2 py-1.5">
                    {col.key === "status" ? (
                      /* Status: checkbox row */
                      <div className="flex items-center gap-2 flex-wrap">
                        {presentStatuses.map(s => (
                          <label key={s} className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={statusFilter.has(s)}
                              onChange={() => toggleStatus(s)}
                              className="h-3.5 w-3.5 accent-gray-700 rounded"
                            />
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusStyle[s] ?? "bg-gray-100 text-gray-600"}`}>
                              {s}
                            </span>
                          </label>
                        ))}
                        {statusFilter.size > 0 && (
                          <button
                            onClick={() => setStatusFilter(new Set())}
                            className="text-xs text-gray-400 hover:text-gray-700 underline ml-1"
                          >
                            clear
                          </button>
                        )}
                      </div>
                    ) : col.filterable ? (
                      <Input
                        placeholder="Filter…"
                        value={colFilters[col.key] ?? ""}
                        onChange={e => setColFilters(f => ({ ...f, [col.key]: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    ) : <div />}
                  </td>
                ))}
              </tr>
            )}
          </thead>

          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-10 text-center text-muted-foreground">
                  No purchase requisitions found.
                </td>
              </tr>
            )}
            {filtered.map(pr => {
              const isOverdue = pr.rsd && new Date(pr.rsd) < new Date() && pr.status !== "RECEIVED";
              return (
                <tr key={pr.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-900 font-medium">{pr.ppoNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{pr.clientName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                      {fmt(pr.rsd)}
                    </span>
                    {isOverdue && <span className="ml-1 text-xs text-red-500">overdue</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{pr.itemCode}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-700">{pr.material}</span>
                  </td>
                  <td className="px-4 py-3">
                    <PRStatusCell
                      itemId={pr.itemId}
                      prId={pr.id}
                      status={pr.status}
                      canEdit={canEdit}
                      onUpdate={(newStatus) => {
                        setRows(prev => prev.map(r => r.id === pr.id ? { ...r, status: newStatus } : r));
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{fmt(pr.requestedDate)}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{fmt(pr.receivedDate)}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{pr.createdBy}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
