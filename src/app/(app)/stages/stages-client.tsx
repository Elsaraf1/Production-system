"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageTable } from "@/components/stages/stage-table";
import { STAGES, type StageKey, type StageRow } from "@/lib/stages";

export function StagesClient({ data, defaultStage, canEdit }: { data: Record<StageKey, StageRow[]>; defaultStage: StageKey; canEdit: Record<StageKey, boolean> }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Production Stages</h1>
        <p className="text-muted-foreground text-sm">Filter and track work item-by-item, stage by stage.</p>
      </div>

      <Tabs defaultValue={defaultStage}>
        <TabsList>
          {STAGES.map(s => (
            <TabsTrigger key={s.key} value={s.key} className="px-3">{s.label}</TabsTrigger>
          ))}
        </TabsList>
        {STAGES.map(s => (
          <TabsContent key={s.key} value={s.key} className="mt-4">
            <StageTable rows={data[s.key]} stageLabel={s.label} stageKey={s.key} canEdit={canEdit[s.key]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
