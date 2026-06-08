"use client";

import { useState, useTransition } from "react";
import { StageStatusBadge } from "./stage-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { StageStatus } from "@/generated/prisma";

const STATUSES: StageStatus[] = ["PENDING", "IN_PROGRESS", "DONE", "NA"];

interface StageCellProps {
  itemId: string;
  stage: string;
  status: StageStatus;
  version: number;
  canEdit: boolean;
  onUpdate?: (newStatus: StageStatus, newVersion: number) => void;
}

export function StageCell({ itemId, stage, status, version, canEdit, onUpdate }: StageCellProps) {
  const [current, setCurrent] = useState<StageStatus>(status);
  const [currentVersion, setCurrentVersion] = useState(version);
  const [conflict, setConflict] = useState<{ serverStatus: StageStatus; serverVersion: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function updateStage(newStatus: StageStatus) {
    startTransition(async () => {
      const res = await fetch(`/api/items/${itemId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, status: newStatus, version: currentVersion }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCurrent(newStatus);
        setCurrentVersion(updated.version);
        onUpdate?.(newStatus, updated.version);
      } else if (res.status === 409) {
        const data = await res.json();
        const serverStatus = data.current[`${stage}Status`] as StageStatus;
        setConflict({ serverStatus, serverVersion: data.current.version });
      }
    });
  }

  function acceptServerVersion() {
    if (!conflict) return;
    setCurrent(conflict.serverStatus);
    setCurrentVersion(conflict.serverVersion);
    setConflict(null);
  }

  async function forceOverride() {
    if (!conflict) return;
    setCurrentVersion(conflict.serverVersion);
    setConflict(null);
    await updateStage(current);
  }

  if (!canEdit) {
    return <StageStatusBadge status={current} />;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          className="cursor-pointer hover:opacity-75 transition-opacity bg-transparent border-0 p-0"
        >
          <StageStatusBadge status={current} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUSES.map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => updateStage(s)}
              className={s === current ? "font-semibold" : ""}
            >
              <StageStatusBadge status={s} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!conflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Conflict</AlertDialogTitle>
            <AlertDialogDescription>
              Someone else updated this stage to{" "}
              <strong>{conflict?.serverStatus}</strong> while you were editing.
              Keep their change or override it with your selection?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={acceptServerVersion}>
              Keep their change
            </AlertDialogCancel>
            <AlertDialogAction onClick={forceOverride}>
              Override with mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
