"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, KeyRound } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function UserActions({
  userId, username, isSelf,
}: {
  userId: string;
  username: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDeactivate() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) { setDeactivateOpen(false); router.refresh(); }
    });
  }

  function openPw() { setPassword(""); setConfirm(""); setPwError(""); setPwOpen(true); }

  function handleChangePassword() {
    if (password.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setPwError("Passwords do not match."); return; }
    setPwError("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPwOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setPwError(data.error ?? "Failed to update password.");
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={openPw}
          className="text-muted-foreground hover:text-blue-600 transition-colors"
          title={`Change password for ${username}`}
        >
          <KeyRound className="h-3.5 w-3.5" />
        </button>
        {!isSelf && (
          <button
            onClick={() => setDeactivateOpen(true)}
            className="text-muted-foreground hover:text-red-500 transition-colors"
            title={`Deactivate ${username}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password — {username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                onKeyDown={e => e.key === "Enter" && handleChangePassword()}
              />
            </div>
            {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isPending}>
              {isPending ? "Saving…" : "Save password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <strong>{username}</strong>. They won&apos;t be able to log in,
              but their history and audit trail will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
