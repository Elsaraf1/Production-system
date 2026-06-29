"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { StageStatusBadge } from "@/components/items/stage-status-badge";
import { StageCell } from "@/components/items/stage-cell";
import { ProductionOrderCell } from "@/components/items/production-order-cell";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { format } from "@/lib/date";
import type { StageStatus } from "@/generated/prisma/client";
import { STAGE_API_KEY, type StageKey, type StageRow } from "@/lib/stages";

const statusStyle: Record<StageStatus, string> = {
  PENDING:     "bg-gray-100 text-gray-500",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE:        "bg-green-100 text-green-700",
  NA:          "bg-zinc-100 text-zinc-400",
};

const statusLabel: Record<StageStatus, string> = {
  PENDING:     "Pending",
  IN_PROGRESS: "In Progress",
  DONE:        "Done",
  NA:          "N/A",
};

const ALL_STATUSES: StageStatus[] = ["PENDING", "IN_PROGRESS", "DONE", "NA"];

type SortKey = keyof Omit<StageRow, "id" | "salesOrderId">;
type SortDir = "asc" | "desc";

const COLS: { key: SortKey; label: string; filterable?: boolean }[] = [
  { key: "ppoNumber",         label: "PPO Number",          filterable: true },
  { key: "clientName",        label: "Client",              filterable: true },
  { key: "rsd",               label: "RSD" },
  { key: "itemCode",          label: "Item Code",           filterable: true },
  { key: "description",       label: "Description",         filterable: true },
  { key: "productionOrderNo", label: "Production Order No", filterable: true },
  { key: "outstandingQty",    label: "Qty" },
  { key: "status",            label: "Status",              filterable: true },
  { key: "date",              label: "Date" },
];

export function StageTable({ rows: initialRows, stageLabel, stageKey, canEdit }: { rows: StageRow[]; stageLabel: string; stageKey: StageKey; canEdit: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [globalFilter, setGlobalFilter] = useState("");
  const [colFilters, setColFilters] = useState<Partial<Record<SortKey, string>>>({});
  const [statusFilter, setStatusFilter] = useState<Set<StageStatus>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("rsd");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showColFilters, setShowColFilters] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const presentStatuses = useMemo(
    () => ALL_STATUSES.filter(s => rows.some(r => r.status === s)),
    [rows]
  );

  function toggleStatus(s: StageStatus) {
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
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av ?? "");
      const bs = String(bv ?? "");
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [rows, globalFilter, colFilters, statusFilter, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c: Record<StageStatus, number> = { PENDING: 0, IN_PROGRESS: 0, DONE: 0, NA: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const groups = useMemo(() => {
    const map = new Map<string, StageRow[]>();
    for (const row of filtered) {
      if (!map.has(row.ppoNumber)) map.set(row.ppoNumber, []);
      map.get(row.ppoNumber)!.push(row);
    }
    return [...map.entries()];
  }, [filtered]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 text-gray-300 inline ml-1" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-gray-600 inline ml-1" />
      : <ChevronDown className="h-3 w-3 text-gray-600 inline ml-1" />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:sticky lg:top-[68px] lg:z-10 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:border-b lg:border-gray-200">
        <div>
          <h2 className="text-lg font-semibold">{stageLabel}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <span>{rows.length} total</span>
            <span className="text-gray-500 font-medium">{counts.PENDING} pending</span>
            <span className="text-blue-600 font-medium">{counts.IN_PROGRESS} in progress</span>
            <span className="text-green-600 font-medium">{counts.DONE} done</span>
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
            onClick={() => setCollapsed(v => !v)}
            className="shrink-0 text-xs px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            {collapsed ? "Show All" : "Collapse All"}
          </button>
          <button
            onClick={() => setShowColFilters(v => !v)}
            className={`shrink-0 text-xs px-3 py-2 rounded-md border transition-colors ${showColFilters ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50"}`}
          >
            Column Filters
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto lg:overflow-visible lg:isolate">
        <table className="w-full text-sm lg:border-separate lg:border-spacing-0 lg:[&_th]:border-b lg:[&_td]:border-b">
          <thead>
            <tr className="bg-gray-50 border-b">
              {COLS.map(col => (
                <th
                  key={col.key}
                  className="lg:sticky lg:z-10 lg:top-[136px] bg-gray-50 text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
            </tr>

            {/* Column filter row */}
            {showColFilters && (
              <tr className="border-b">
                {COLS.map(col => (
                  <td key={col.key} className="lg:sticky lg:z-10 lg:top-[180px] bg-gray-50 px-2 py-1.5">
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
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusStyle[s]}`}>
                              {statusLabel[s]}
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
                  No items found.
                </td>
              </tr>
            )}
            {collapsed && groups.map(([ppo, groupRows]) => {
              const first = groupRows[0];
              const isGroupOverdue = new Date(first.rsd) < new Date();
              return (
                <tr key={ppo} className="hover:bg-gray-50/70 transition-colors">
                  <td colSpan={COLS.length} className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap text-sm">
                      <Link href={`/orders/${first.salesOrderId}`} className="font-mono font-semibold text-gray-900 hover:underline">
                        {ppo}
                      </Link>
                      <span className="text-gray-600">{first.clientName}</span>
                      <span className={isGroupOverdue ? "text-red-600 font-medium" : "text-gray-500"}>
                        {format(first.rsd)}
                      </span>
                      <span className="text-gray-400 ml-auto">
                        {groupRows.length} item{groupRows.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!collapsed && filtered.map(row => {
              const isOverdue = row.status !== "DONE" && row.status !== "NA" && new Date(row.rsd) < new Date();
              return (
                <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-900 font-medium">
                    <Link href={`/orders/${row.salesOrderId}`} className="hover:underline">{row.ppoNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.clientName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                      {format(row.rsd)}
                    </span>
                    {isOverdue && <span className="ml-1 text-xs text-red-500">overdue</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.itemCode}</td>
                  <td className="px-4 py-3 text-gray-600">{row.description}</td>
                  <td className="px-4 py-3"><ProductionOrderCell value={row.productionOrderNo} /></td>
                  <td className="px-4 py-3 text-gray-600">{row.outstandingQty}</td>
                  <td className="px-4 py-3">
                    {stageKey === "PR" ? (
                      <StageStatusBadge status={row.status} />
                    ) : (
                      <StageCell
                        itemId={row.id}
                        stage={STAGE_API_KEY[stageKey]}
                        status={row.status}
                        version={row.version}
                        canEdit={canEdit}
                        onUpdate={(newStatus, newVersion) => {
                          setRows(prev => prev.map(r =>
                            r.id === row.id ? { ...r, status: newStatus, version: newVersion, date: null } : r
                          ));
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{format(row.date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
