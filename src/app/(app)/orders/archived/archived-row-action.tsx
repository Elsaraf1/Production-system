"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function UnarchiveRowAction({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUnarchive() {
    setLoading(true);
    setConfirming(false);
    const res = await fetch(`/api/orders/${orderId}/archive`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to unarchive.");
      setLoading(false);
    }
  }

  if (loading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400 inline" />;

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-gray-500">Unarchive?</span>
        <button onClick={handleUnarchive} className="text-xs font-medium text-blue-700 hover:text-blue-900">
          Yes
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-blue-700 hover:text-blue-900 underline decoration-dotted underline-offset-2"
      >
        Unarchive
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  );
}
