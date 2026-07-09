"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload, Download, CheckCircle, AlertTriangle, Lock,
  FileSpreadsheet, FileCheck2, ShoppingCart, PackageCheck, ArrowLeft, Boxes,
} from "lucide-react";

// ─── Tab config ──────────────────────────────────────────────────────────────

const TABS = [
  {
    id: "planner",
    label: "Planner Import",
    subtitle: "Orders & Stage Data",
    icon: FileSpreadsheet,
    color: "blue",
    columns: ["PPO Number*", "Item Code*", "Client Name", "Order Date", "RSD", "Description", "Production Order No", "Outstanding Qty", "Drawing/Carpentry/Painting/Upholstery/Packing Status"],
    effect: "Creates new orders/items and updates existing stage statuses. Set Production Order No to \"Inventored\" to mark all 5 stages as Done.",
    roles: ["ADMIN", "GM", "BD", "PLANNER"],
    apiPath: "/api/import",
    confirmApiPath: "/api/import/confirm",
    sampleType: "planner",
    isJson: true,
  },
  {
    id: "releasing",
    label: "Releasing Order",
    subtitle: "Mark Drawing as Done",
    icon: FileCheck2,
    color: "amber",
    columns: ["PPO Number*", "Item Code*"],
    effect: "Sets Drawing Status → DONE for all matching items (including duplicates in same order).",
    roles: ["ADMIN", "TECHNICAL"],
    apiPath: "/api/import/releasing",
    confirmApiPath: "/api/import/releasing",
    sampleType: "releasing",
    isJson: false,
  },
  {
    id: "material-request",
    label: "Material Request",
    subtitle: "Flag Materials Needed 🛒",
    icon: ShoppingCart,
    color: "orange",
    columns: ["PPO Number*", "Item Code*", "Material*"],
    effect: "Creates a material request for all matching items. Valid materials: Marble, Glass, Mirror, Porcelain, Metal, Handles, Brass, Lamitak & Lipping, Other. Use N/A to mark an item as needing no material.",
    roles: ["ADMIN", "TECHNICAL"],
    apiPath: "/api/import/material-request",
    confirmApiPath: "/api/import/material-request",
    sampleType: "material-request",
    isJson: false,
  },
  {
    id: "material-receive",
    label: "Material Receive",
    subtitle: "Mark Materials Arrived 📦",
    icon: PackageCheck,
    color: "green",
    columns: ["PPO Number*", "Item Code*", "Material*"],
    effect: "Updates material status to Received for all matching items.",
    roles: ["ADMIN", "PROCUREMENT"],
    apiPath: "/api/import/material-receive",
    confirmApiPath: "/api/import/material-receive",
    sampleType: "material-receive",
    isJson: false,
  },
  {
    id: "inventory-update",
    label: "Inventory Update",
    subtitle: "Mark Items as Inventored",
    icon: Boxes,
    color: "purple",
    columns: ["Item ID*", "PPO Number", "Item Code", "Production Order No*"],
    effect: "Download the sample file to get a live list of every item with its current Production Order No. Change a row's Production Order No to \"Inventored\" to mark all its stages as Done (stages already set to N/A are left as N/A). Don't edit or remove the Item ID column — it's used to match the row.",
    roles: ["ADMIN", "GM", "BD", "PLANNER"],
    apiPath: "/api/import/inventory-update",
    confirmApiPath: "/api/import/inventory-update",
    sampleType: "inventory-update",
    isJson: false,
  },
] as const;

type TabId = typeof TABS[number]["id"];

const cardColors = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-200",   icon: "text-blue-500",   ring: "ring-blue-400",  badge: "bg-blue-100 text-blue-700" },
  amber:  { bg: "bg-amber-50",  border: "border-amber-200",  icon: "text-amber-500",  ring: "ring-amber-400", badge: "bg-amber-100 text-amber-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-500", ring: "ring-orange-400",badge: "bg-orange-100 text-orange-700" },
  green:  { bg: "bg-green-50",  border: "border-green-200",  icon: "text-green-500",  ring: "ring-green-400", badge: "bg-green-100 text-green-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-500", ring: "ring-purple-400", badge: "bg-purple-100 text-purple-700" },
};

// ─── Single import flow ───────────────────────────────────────────────────────

type Step = "upload" | "preview" | "done";

function ImportFlow({ tab, onBack }: { tab: typeof TABS[number]; onBack: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[]>([]);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [isPending, startTransition] = useTransition();

  const c = cardColors[tab.color as keyof typeof cardColors];
  const Icon = tab.icon;

  function reset() { setStep("upload"); setFile(null); setPreview(null); setParseErrors([]); setRows([]); setResult(null); }

  async function handleUpload() {
    if (!file) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(tab.apiPath, { method: "POST", body: fd });
        if (!res.ok && res.headers.get("content-type")?.includes("text/html")) {
          setParseErrors([`Server error (${res.status}). Check Vercel function logs.`]);
          return;
        }
        const data = await res.json();
        setParseErrors(data.errors ?? []);
        if ((data.errors?.length && !data.preview && !data.rows)) return;
        setPreview(data.preview ?? null);
        setRows(data.rows ?? []);
        setStep("preview");
      } catch (err) {
        setParseErrors([`Unexpected error: ${err instanceof Error ? err.message : String(err)}`]);
      }
    });
  }

  async function handleConfirm() {
    startTransition(async () => {
      try {
        let res: Response;
        if (tab.isJson) {
          res = await fetch(tab.confirmApiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
        } else {
          const fd = new FormData();
          fd.append("file", file!);
          fd.append("confirm", "true");
          res = await fetch(tab.confirmApiPath, { method: "POST", body: fd });
        }
        if (!res.ok && res.headers.get("content-type")?.includes("text/html")) {
          setParseErrors([`Server error (${res.status}). Check Vercel function logs.`]);
          setStep("upload");
          return;
        }
        const data = await res.json();
        setResult(data);
        setStep("done");
      } catch (err) {
        setParseErrors([`Unexpected error: ${err instanceof Error ? err.message : String(err)}`]);
        setStep("upload");
      }
    });
  }

  const plannerPreview = tab.id === "planner" && Array.isArray(preview) ? preview as Array<{ ppoNumber: string; itemCode: string; isNewOrder: boolean; isNewItem: boolean; affectsCount: number; changes: string[] }> : null;
  const stdPreview = tab.id !== "planner" && preview && !Array.isArray(preview) ? preview as { total?: number; matched?: number; toUpdate?: number; toCreate?: number; notFound?: number; items?: Array<{ ppoNumber: string; itemCode: string; material?: string; willChange: boolean; changes?: string[] }> } : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`rounded-xl border-2 ${c.border} ${c.bg} p-4 flex items-center gap-4`}>
        <div className={`rounded-lg p-2 bg-white shadow-sm`}>
          <Icon className={`h-6 w-6 ${c.icon}`} />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-base">{tab.label}</h2>
          <p className="text-xs text-muted-foreground">{tab.effect}</p>
        </div>
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Column reference + sample */}
      <div className="rounded-lg bg-gray-50 border px-4 py-3 text-sm space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-700">Required columns <span className="font-normal text-gray-400 text-xs">(case-insensitive, * = required)</span></p>
          <a href={`/api/import/sample?type=${tab.sampleType}`} download>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Download className="h-3 w-3" /> Sample File
            </Button>
          </a>
        </div>
        <p className="text-gray-600 text-xs">{tab.columns.join("  ·  ")}</p>
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <Card className="border-dashed border-2">
          <CardContent className="pt-6 space-y-4">
            <label className="flex flex-col items-center gap-3 cursor-pointer group">
              <div className={`rounded-full p-4 ${c.bg} group-hover:scale-105 transition-transform`}>
                <Upload className={`h-8 w-8 ${c.icon}`} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Drop your file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-0.5">Accepts .xlsx and .xls files</p>
              </div>
              <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            </label>

            {file && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {file.name}
              </div>
            )}

            {parseErrors.length > 0 && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 space-y-1">
                <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> File validation failed — nothing was uploaded
                </p>
                {parseErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}

            <Button onClick={handleUpload} disabled={!file || isPending} className="w-full">
              {isPending ? "Parsing…" : "Parse & Preview →"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {plannerPreview && (
              <>
                <StatCard label="New Orders"    value={plannerPreview.filter(r => r.isNewOrder).length}                               color="blue" />
                <StatCard label="New Items"     value={plannerPreview.filter(r => r.isNewItem).length}                                color="green" />
                <StatCard label="Updated"       value={plannerPreview.filter(r => !r.isNewItem && r.changes.length > 0).length}       color="orange" />
                <StatCard label="Unchanged"     value={plannerPreview.filter(r => !r.isNewItem && r.changes.length === 0).length}     color="gray" />
              </>
            )}
            {stdPreview && (
              <>
                <StatCard label="Rows in file"  value={stdPreview.total ?? 0}                                                          color="blue" />
                <StatCard label="Matched"       value={stdPreview.matched ?? 0}                                                        color="green" />
                <StatCard label="Will update"   value={stdPreview.toUpdate ?? stdPreview.toCreate ?? 0}                               color="orange" />
                <StatCard label="Not found"     value={stdPreview.notFound ?? 0}                                                       color="red" />
              </>
            )}
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
              <p className="text-xs font-medium text-orange-700 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {parseErrors.length} warning(s) — rows not found will be skipped
              </p>
              {parseErrors.slice(0, 6).map((e, i) => <p key={i} className="text-xs text-orange-600">{e}</p>)}
              {parseErrors.length > 6 && <p className="text-xs text-orange-500">…and {parseErrors.length - 6} more</p>}
            </div>
          )}

          {/* Preview table */}
          <div className="rounded-lg border bg-white overflow-x-auto max-h-72 overflow-y-auto text-xs">
            <table className="w-full">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">PPO</th>
                  <th className="text-left px-3 py-2 font-medium">Item Code</th>
                  {tab.id !== "planner" && tab.id !== "inventory-update" && <th className="text-left px-3 py-2 font-medium">Material</th>}
                  <th className="text-left px-3 py-2 font-medium">Action</th>
                  <th className="text-left px-3 py-2 font-medium">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {((stdPreview?.items ?? plannerPreview) ?? []).map((item: Record<string, unknown>, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono">{item.ppoNumber as string}</td>
                    <td className="px-3 py-1.5 font-mono">{item.itemCode as string}</td>
                    {tab.id !== "planner" && tab.id !== "inventory-update" && <td className="px-3 py-1.5">{(item.material as string) ?? "—"}</td>}
                    <td className="px-3 py-1.5">
                      {item.isNewItem
                        ? <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">New</span>
                        : item.willChange === false
                          ? <span className="text-xs text-gray-400">No change</span>
                          : <span className="text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Update</span>}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground max-w-xs truncate">
                      {Array.isArray(item.changes) ? (item.changes as string[]).join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleConfirm} disabled={isPending} className="flex-1">
              {isPending ? "Importing…" : "Confirm Import"}
            </Button>
            <Button variant="outline" onClick={() => { setStep("upload"); setParseErrors([]); }}>
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <Card>
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className={`mx-auto w-16 h-16 rounded-full ${c.bg} flex items-center justify-center`}>
              <CheckCircle className={`h-8 w-8 ${c.icon}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Import Complete</h3>
              <p className="text-sm text-muted-foreground">All changes have been applied and logged.</p>
            </div>
            <div className="flex justify-center gap-8">
              {Object.entries(result).map(([k, v]) => (
                <div key={k} className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{v as number}</p>
                  <p className="text-xs text-muted-foreground capitalize">{k}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={reset}>Import Another File</Button>
              <Button variant="outline" onClick={onBack}>Back to Import</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50", green: "text-green-600 bg-green-50",
    orange: "text-orange-600 bg-orange-50", red: "text-red-600 bg-red-50", gray: "text-gray-500 bg-gray-50",
  };
  return (
    <div className={`rounded-lg p-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

// ─── Main page — 2×2 card selector ───────────────────────────────────────────

export default function ImportPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const [selected, setSelected] = useState<TabId | null>(null);

  const activeTab = TABS.find(t => t.id === selected);

  if (activeTab) {
    return (
      <div className="max-w-2xl space-y-1">
        <ImportFlow tab={activeTab} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose an import type below. Locked options require a different role.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TABS.map(tab => {
          const canUse = (tab.roles as readonly string[]).includes(role);
          const c = cardColors[tab.color as keyof typeof cardColors];
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => canUse && setSelected(tab.id)}
              disabled={!canUse}
              className={`
                relative text-left rounded-xl border-2 p-5 transition-all group
                ${canUse
                  ? `${c.border} ${c.bg} hover:shadow-md hover:scale-[1.02] cursor-pointer ring-0 hover:ring-2 ${c.ring}`
                  : "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"}
              `}
            >
              {!canUse && (
                <div className="absolute top-3 right-3">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
              )}

              <div className={`rounded-xl p-3 w-fit ${canUse ? "bg-white shadow-sm" : "bg-gray-100"} mb-4`}>
                <Icon className={`h-7 w-7 ${canUse ? c.icon : "text-gray-400"}`} />
              </div>

              <h3 className="font-semibold text-base leading-tight">{tab.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{tab.subtitle}</p>

              <div className="mt-4 flex flex-wrap gap-1">
                {tab.roles.map(r => (
                  <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${canUse ? c.badge : "bg-gray-100 text-gray-400"}`}>
                    {r}
                  </span>
                ))}
              </div>

              {canUse && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500 group-hover:text-gray-700">
                  <Upload className="h-3 w-3" /> Upload file
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
