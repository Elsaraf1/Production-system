"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TestEmailForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setMessage("");
    startTransition(async () => {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("ok");
        setMessage(`Test email sent to ${email}. Check the inbox.`);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Failed to send test email.");
      }
    });
  }

  return (
    <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="test-email" className="text-xs text-muted-foreground">Send a test email to</Label>
        <Input
          id="test-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="recipient@company.com"
          required
        />
      </div>
      <div className="sm:self-end">
        <Button type="submit" size="sm" variant="outline" disabled={isPending} className="w-full sm:w-auto">
          <Send className="h-4 w-4 mr-1.5" />
          {isPending ? "Sending…" : "Send test"}
        </Button>
      </div>
      {status !== "idle" && (
        <p className={`text-sm sm:col-span-2 self-end pb-0.5 ${status === "ok" ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
