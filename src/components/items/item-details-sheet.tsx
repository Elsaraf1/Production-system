"use client";

import { useState, useEffect, useTransition } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle, ShoppingCart, PackageCheck } from "lucide-react";
import type { Role } from "@/generated/prisma";

interface Note {
  id: string; content: string; createdAt: string;
  author: { displayName: string }; authorId: string;
}

interface PR {
  id: string; material: string; status: string;
  requestedDate: string | null; createdAt: string;
  createdBy: { displayName: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemCode: string;
  reasonOfDelay: string | null;
  requiresMaterial: boolean;
  initialPRs?: { material: string; status: string }[];
  userId: string;
  role: Role;
  onPRsChange?: (prs: { material: string; status: string }[]) => void;
  onRequiresMaterialChange?: (value: boolean) => void;
}

const MATERIALS = [
  { key: "MARBLE",    label: "Marble" },
  { key: "METAL",     label: "Metal" },
  { key: "GLASS",     label: "Glass" },
  { key: "HANDLES",   label: "Handle" },
  { key: "MIRROR",    label: "Mirror" },
  { key: "PORCELAIN", label: "Porcelain" },
  { key: "OTHER",     label: "Other" },
] as const;

export function ItemDetailsSheet({
  open, onClose, itemId, itemCode,
  reasonOfDelay: initialDelay, requiresMaterial: initialRequiresMaterial, initialPRs = [],
  userId, role, onPRsChange, onRequiresMaterialChange,
}: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [prs, setPRs] = useState<PR[]>([]);
  const [delay, setDelay] = useState(initialDelay ?? "");
  const [savedDelay, setSavedDelay] = useState(initialDelay);
  const [requiresMaterial, setRequiresMaterial] = useState(initialRequiresMaterial);
  const [newNote, setNewNote] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    fetch(`/api/items/${itemId}/notes`).then(r => r.json()).then(setNotes);
    fetch(`/api/items/${itemId}/prs`).then(r => r.json()).then(setPRs);
  }, [open, itemId]);

  // Notify parent of PR changes for live icon update
  useEffect(() => {
    onPRsChange?.(prs.map(p => ({ material: p.material, status: p.status })));
  }, [prs]);

  const canNote = ["ADMIN", "PRODUCTION", "PLANNER", "TECHNICAL", "PROCUREMENT"].includes(role);
  const canDelay = ["ADMIN", "PRODUCTION", "PLANNER"].includes(role);
  const canDeleteDelay = role === "ADMIN";
  const canRequest = ["ADMIN", "TECHNICAL"].includes(role);    // can check Required
  const canReceive = ["ADMIN", "PROCUREMENT"].includes(role);  // can check Arrived

  function activePR(material: string) {
    return prs.find(p => p.material === material && p.status !== "CANCELLED");
  }

  function isRequired(material: string) { return !!activePR(material); }
  function isArrived(material: string) { return activePR(material)?.status === "RECEIVED"; }

  async function toggleRequired(material: string, checked: boolean) {
    startTransition(async () => {
      if (checked) {
        const res = await fetch(`/api/items/${itemId}/prs`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prNumber: `${itemId.slice(-6).toUpperCase()}-${material}`,
            material, quantity: 1, unit: "-",
            requestedDate: new Date().toISOString().split("T")[0],
          }),
        });
        if (res.ok) { const pr = await res.json(); setPRs(prev => [...prev, pr]); }
      } else {
        const pr = activePR(material);
        if (!pr) return;
        const res = await fetch(`/api/items/${itemId}/prs/${pr.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        });
        if (res.ok) setPRs(prev => prev.map(p => p.id === pr.id ? { ...p, status: "CANCELLED" } : p));
      }
    });
  }

  async function setNeedsNoMaterial(value: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}/material-flag`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresMaterial: !value }),
      });
      if (res.ok) {
        setRequiresMaterial(!value);
        onRequiresMaterialChange?.(!value);
      }
    });
  }

  async function toggleArrived(material: string, checked: boolean) {
    const pr = activePR(material);
    if (!pr) return;
    startTransition(async () => {
      const newStatus = checked ? "RECEIVED" : "SUBMITTED";
      const res = await fetch(`/api/items/${itemId}/prs/${pr.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setPRs(prev => prev.map(p => p.id === pr.id ? { ...p, status: newStatus } : p));
    });
  }

  async function addNote() {
    if (!newNote.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });
      if (res.ok) { const note = await res.json(); setNotes(n => [...n, note]); setNewNote(""); }
    });
  }

  async function deleteNote(noteId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}/notes/${noteId}`, { method: "DELETE" });
      if (res.ok) setNotes(n => n.filter(x => x.id !== noteId));
    });
  }

  async function saveDelay() {
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}/delay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: delay }),
      });
      if (res.ok) setSavedDelay(delay);
    });
  }

  async function removeDelay() {
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}/delay`, { method: "DELETE" });
      if (res.ok) { setDelay(""); setSavedDelay(null); }
    });
  }

  const activeMaterials = MATERIALS.filter(m => isRequired(m.key));
  const arrivedCount = activeMaterials.filter(m => isArrived(m.key)).length;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Item: {itemCode}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="materials" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="materials" className="flex-1">
              Materials {activeMaterials.length > 0 ? `(${arrivedCount}/${activeMaterials.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="delay" className="flex-1">Delay {savedDelay ? "⚠" : ""}</TabsTrigger>
          </TabsList>

          {/* ── Materials ── */}
          <TabsContent value="materials" className="mt-4">
            <label className={`flex items-center gap-2 mb-3 px-1 select-none ${canRequest ? "cursor-pointer" : ""}`}>
              <input
                type="checkbox"
                checked={!requiresMaterial}
                disabled={isPending || !canRequest}
                onChange={e => setNeedsNoMaterial(e.target.checked)}
                className="h-4 w-4 accent-zinc-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-sm">
                This item needs no material <span className="text-muted-foreground">(mark as N/A)</span>
              </span>
            </label>
            <table className={`w-full text-sm ${!requiresMaterial ? "opacity-40 pointer-events-none" : ""}`}>
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-muted-foreground">Material</th>
                  <th className="py-2 w-14 text-center" title="Required (Technical)">
                    <ShoppingCart className="h-4 w-4 text-amber-500 mx-auto" />
                  </th>
                  <th className="py-2 w-14 text-center" title="Arrived (Procurement)">
                    <PackageCheck className="h-4 w-4 text-green-500 mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {MATERIALS.map(({ key, label }) => {
                  const required = isRequired(key);
                  const arrived = isArrived(key);
                  const pr = activePR(key);
                  return (
                    <tr key={key} className={`border-b last:border-0 ${!required ? "opacity-40" : ""}`}>
                      <td className="py-2.5">
                        <div>
                          <span className="font-medium">{label}</span>
                          {pr && (
                            <p className="text-xs text-muted-foreground">
                              {pr.createdBy.displayName} · {new Date(pr.requestedDate ?? pr.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </p>
                          )}
                        </div>
                      </td>
                      {/* Required checkbox */}
                      <td className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={required}
                          disabled={isPending || !canRequest}
                          onChange={e => toggleRequired(key, e.target.checked)}
                          className="h-4 w-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      {/* Arrived checkbox — only active if Required is checked */}
                      <td className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={arrived}
                          disabled={isPending || !canReceive || !required}
                          onChange={e => toggleArrived(key, e.target.checked)}
                          className="h-4 w-4 accent-green-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3">
              <ShoppingCart className="h-3 w-3 inline mr-1 text-amber-500" />Technical team marks what&apos;s needed ·{" "}
              <PackageCheck className="h-3 w-3 inline mr-1 text-green-500" />Procurement marks what arrived
            </p>
          </TabsContent>

          {/* ── Notes ── */}
          <TabsContent value="notes" className="space-y-3 mt-4">
            {notes.map(note => (
              <div key={note.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1">{note.content}</p>
                  {(note.authorId === userId || role === "ADMIN") && (
                    <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-red-500 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {note.author.displayName} · {new Date(note.createdAt).toLocaleString("en-GB")}
                </p>
              </div>
            ))}
            {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>}
            {canNote && (
              <div className="space-y-2 pt-2 border-t">
                <Textarea placeholder="Add a note…" value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} />
                <Button size="sm" onClick={addNote} disabled={isPending || !newNote.trim()}>Add Note</Button>
              </div>
            )}
          </TabsContent>

          {/* ── Delay ── */}
          <TabsContent value="delay" className="space-y-4 mt-4">
            {savedDelay && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <p className="text-sm">{savedDelay}</p>
              </div>
            )}
            {canDelay && (
              <div className="space-y-2">
                <Label>Reason of Delay</Label>
                <Textarea value={delay} onChange={e => setDelay(e.target.value)} placeholder="Describe the delay reason…" rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDelay} disabled={isPending || !delay.trim()}>Save</Button>
                  {savedDelay && canDeleteDelay && (
                    <Button size="sm" variant="destructive" onClick={removeDelay} disabled={isPending}>Remove</Button>
                  )}
                </div>
              </div>
            )}
            {!canDelay && !savedDelay && <p className="text-sm text-muted-foreground">No delay reason recorded.</p>}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
