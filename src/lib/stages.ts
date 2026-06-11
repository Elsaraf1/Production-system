import type { StageStatus } from "@/generated/prisma/client";

export type StageKey = "DRAWING" | "CARPENTRY" | "PAINTING" | "UPHOLSTERY" | "PACKING" | "PR";

export interface StageRow {
  id: string;
  salesOrderId: string;
  ppoNumber: string;
  clientName: string;
  rsd: string;
  itemCode: string;
  description: string;
  productionOrderNo: string;
  outstandingQty: number;
  status: StageStatus;
  date: string | null;
  version: number;
}

export const STAGES: { key: StageKey; label: string }[] = [
  { key: "DRAWING",    label: "Drawing" },
  { key: "CARPENTRY",  label: "Carpentry" },
  { key: "PAINTING",   label: "Painting" },
  { key: "UPHOLSTERY", label: "Upholstery" },
  { key: "PACKING",    label: "Packing" },
  { key: "PR",         label: "PR" },
];

/** Maps a StageKey to the lowercase `stage` param expected by PATCH /api/items/[itemId]/stage */
export const STAGE_API_KEY: Record<Exclude<StageKey, "PR">, string> = {
  DRAWING:    "drawing",
  CARPENTRY:  "carpentry",
  PAINTING:   "painting",
  UPHOLSTERY: "upholstery",
  PACKING:    "packing",
};
