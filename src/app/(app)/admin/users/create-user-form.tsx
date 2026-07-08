"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";

const ROLES = ["ADMIN", "GM", "PRODUCTION", "PLANNER", "TECHNICAL", "PROCUREMENT", "SALES"];
const DEPARTMENTS = ["DRAWING", "CARPENTRY", "PAINTING", "UPHOLSTERY", "PACKING", "PR_CREATION"];
const DEPT_ROLES = ["PRODUCTION", "TECHNICAL", "PROCUREMENT"];

export function CreateUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    username: "", password: "", displayName: "", role: "PRODUCTION", department: "", email: "",
  });

  const needsDept = DEPT_ROLES.includes(form.role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, department: needsDept ? form.department || null : null }),
      });
      if (res.ok) {
        setForm({ username: "", password: "", displayName: "", role: "PRODUCTION", department: "", email: "" });
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to create user");
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <UserPlus className="h-4 w-4 mr-2" /> Add User
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New User</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="e.g. john.doe" />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="Min 6 characters" />
          </div>
          <div className="space-y-1">
            <Label>Display Name</Label>
            <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} required placeholder="Full name" />
          </div>
          <div className="space-y-1">
            <Label>Email <span className="text-muted-foreground font-normal text-xs">(for notifications)</span></Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@company.com" />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v ?? "", department: "" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {needsDept && (
            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-sm text-red-500 col-span-2">{error}</p>}
          <div className="flex gap-2 col-span-2">
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Creating…" : "Create User"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
