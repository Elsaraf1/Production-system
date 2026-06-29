"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageTable } from "@/components/stages/stage-table";
import { STAGES, type StageKey, type StageRow } from "@/lib/stages";

const STAGE_COLORS: Record<StageKey, string> = {
  DRAWING:    "data-active:bg-sky-500 data-active:text-white data-active:border-sky-500",
  CARPENTRY:  "data-active:bg-amber-500 data-active:text-white data-active:border-amber-500",
  PAINTING:   "data-active:bg-rose-500 data-active:text-white data-active:border-rose-500",
  UPHOLSTERY: "data-active:bg-teal-500 data-active:text-white data-active:border-teal-500",
  PACKING:    "data-active:bg-indigo-500 data-active:text-white data-active:border-indigo-500",
  PR:         "data-active:bg-violet-500 data-active:text-white data-active:border-violet-500",
};

export function StagesClient({ data, defaultStage, canEdit }: { data: Record<StageKey, StageRow[]>; defaultStage: StageKey; canEdit: Record<StageKey, boolean> }) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultStage}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:sticky lg:top-0 lg:z-30 lg:bg-gray-50 lg:-mx-7 lg:px-7 lg:h-[68px] lg:border-b lg:border-gray-200">
          <div>
            <h1 className="text-2xl font-semibold">Production Stages</h1>
            <p className="text-muted-foreground text-sm">Filter and track work item-by-item, stage by stage.</p>
          </div>
          <TabsList className="h-auto flex-wrap bg-gray-100 p-1 gap-1">
            {STAGES.map(s => (
              <TabsTrigger
                key={s.key}
                value={s.key}
                className={`rounded-full px-4 py-1.5 font-medium border border-transparent transition-colors ${STAGE_COLORS[s.key]}`}
              >
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {STAGES.map(s => (
          <TabsContent key={s.key} value={s.key} className="mt-4">
            <StageTable rows={data[s.key]} stageLabel={s.label} stageKey={s.key} canEdit={canEdit[s.key]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
