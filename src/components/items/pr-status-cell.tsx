"use client";

import { useState, useTransition } from "react";
import { PRStatusBadge } from "./pr-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PRStatus } from "@/generated/prisma/client";

const STATUSES: PRStatus[] = ["ORDERED", "RECEIVED"];

interface PRStatusCellProps {
  itemId: string;
  prId: string;
  status: PRStatus;
  canEdit: boolean;
  onUpdate?: (newStatus: PRStatus, receivedDate?: string | null) => void;
}

export function PRStatusCell({ itemId, prId, status, canEdit, onUpdate }: PRStatusCellProps) {
  const [current, setCurrent] = useState<PRStatus>(status);
  const [isPending, startTransition] = useTransition();

  function updateStatus(newStatus: PRStatus) {
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}/prs/${prId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrent(newStatus);
        onUpdate?.(newStatus, data.receivedDate ?? null);
      }
    });
  }

  if (!canEdit) {
    return <PRStatusBadge status={current} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="cursor-pointer hover:opacity-75 transition-opacity bg-transparent border-0 p-0"
      >
        <PRStatusBadge status={current} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => updateStatus(s)}
            className={s === current ? "font-semibold" : ""}
          >
            <PRStatusBadge status={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
