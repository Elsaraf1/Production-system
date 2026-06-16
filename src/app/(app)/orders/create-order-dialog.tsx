"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function CreateOrderDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ ppoNumber: "", clientName: "", orderDate: today, rsd: "" });

  function reset() {
    setForm({ ppoNumber: "", clientName: "", orderDate: today, rsd: "" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const order = await res.json();
        setOpen(false);
        reset();
        router.push(`/orders/${order.id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create order");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ppoNumber">PPO Number</Label>
            <Input
              id="ppoNumber"
              value={form.ppoNumber}
              onChange={e => setForm(f => ({ ...f, ppoNumber: e.target.value }))}
              placeholder="e.g. PPO-12008501"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              value={form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              placeholder="e.g. Khaled Al Mashary"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="orderDate">Order Date</Label>
              <Input
                id="orderDate"
                type="date"
                value={form.orderDate}
                onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsd">
                RSD <span className="text-muted-foreground font-normal text-xs">(Required Ship Date)</span>
              </Label>
              <Input
                id="rsd"
                type="date"
                value={form.rsd}
                onChange={e => setForm(f => ({ ...f, rsd: e.target.value }))}
                required
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Creating…" : "Create Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
