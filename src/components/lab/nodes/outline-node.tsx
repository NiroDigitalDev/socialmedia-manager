"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { ListIcon, PaletteIcon } from "lucide-react";
import { useLabStore } from "@/stores/use-lab-store";
import { useStyles } from "@/hooks/use-styles";
import type { LabNode } from "../canvas";
import { LabNodeCard } from "./lab-node-card";

type LabFlowNode = Node<LabNode>;

interface OutlineOutput {
  slides?: Array<{ title?: string; description?: string }>;
  overallTheme?: string;
}

export const OutlineNode = memo(function OutlineNode({
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const output = data.output as OutlineOutput | null;
  const firstTitle = output?.slides?.[0]?.title ?? output?.overallTheme ?? "";

  const collapsedIds = useLabStore((s) => s.collapsedIds);
  const toggleCollapsed = useLabStore((s) => s.toggleCollapsed);
  const isCollapsed = collapsedIds.has(data.id);
  const childCount = (data as LabNode & { _childCount?: number })._childCount ?? 0;

  const { data: styles } = useStyles();
  const imageStyleName = data.imageStyleId
    ? styles?.find((s) => s.id === data.imageStyleId)?.name
    : null;

  return (
    <LabNodeCard
      layer={data.layer}
      status={data.status}
      rating={data.rating}
      selected={selected}
      childCount={childCount}
      collapsed={isCollapsed}
      onToggleCollapse={() => toggleCollapsed(data.id)}
    >
      <div className="flex items-start gap-1.5">
        <ListIcon className="mt-0.5 size-3.5 shrink-0 text-yellow-500" />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">
            {firstTitle || "Outline"}
          </div>
          {imageStyleName && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <PaletteIcon className="size-2.5" />
              {imageStyleName}
            </div>
          )}
        </div>
      </div>
    </LabNodeCard>
  );
});
