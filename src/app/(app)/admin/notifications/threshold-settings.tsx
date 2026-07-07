"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

const STAGE_LABELS = [
  { key: "drawing",    label: "Drawing",                 color: "text-sky-600" },
  { key: "carpentry",  label: "Carpentry",               color: "text-amber-600" },
  { key: "painting",   label: "Painting",                color: "text-rose-600" },
  { key: "upholstery", label: "Upholstery",              color: "text-teal-600" },
  { key: "packing",    label: "Packing",                 color: "text-indigo-600" },
  { key: "procurement",label: "Procurement (PR ordered)", color: "text-violet-600" },
];

type Thresholds = { drawing: number; carpentry: number; painting: number; upholstery: number; packing: number; procurement: number };

export function ThresholdSettings({ initial }: { initial: Thresholds }) {
  const [values, setValues] = useState<Thresholds>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "overdue_thresholds", value: JSON.stringify(values) }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STAGE_LABELS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <label className={`text-sm font-medium ${color} min-w-0`}>{label}</label>
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number"
                min={1}
                max={365}
                value={values[key as keyof Thresholds]}
                onChange={e => setValues(v => ({
                  ...v,
                  [key]: Math.max(1, parseInt(e.target.value) || 1),
                }))}
                className="h-8 w-16 text-center text-sm"
              />
              <span className="text-xs text-gray-400 w-8">days</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
