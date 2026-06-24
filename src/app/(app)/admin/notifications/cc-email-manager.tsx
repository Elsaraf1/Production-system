"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CcRow { id: string; email: string; label: string | null; createdAt: Date; }

export function CcEmailManager({ initialRows }: { initialRows: CcRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<CcRow[]>(initialRows);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/admin/cc-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), label: label.trim() }),
      });
      if (res.ok) {
        const row = await res.json();
        setRows(r => [...r, row]);
        setEmail("");
        setLabel("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to add email.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/cc-emails/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRows(r => r.filter(row => row.id !== id));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="cc-email" className="text-xs text-muted-foreground">Email address</Label>
          <Input
            id="cc-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="manager@company.com"
            required
          />
        </div>
        <div className="sm:w-44 space-y-1">
          <Label htmlFor="cc-label" className="text-xs text-muted-foreground">Label (optional)</Label>
          <Input
            id="cc-label"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. GM"
          />
        </div>
        <div className="sm:self-end">
          <Button type="submit" size="sm" disabled={isPending} className="w-full sm:w-auto">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        </div>
      </form>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* List */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-gray-50">
          No CC emails yet. Add one above.
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Label</th>
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{row.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.label ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      title="Remove from CC list"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
