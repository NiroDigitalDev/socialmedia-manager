"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { ListIcon } from "lucide-react";
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
  const slideCount = output?.slides?.length ?? 0;
  const firstTitle = output?.slides?.[0]?.title ?? output?.overallTheme ?? "";

  return (
    <LabNodeCard
      layer={data.layer}
      status={data.status}
      rating={data.rating}
      selected={selected}
    >
      <div className="flex items-start gap-1.5">
        <ListIcon className="mt-0.5 size-3.5 shrink-0 text-yellow-500" />
        <div className="min-w-0">
          <div className="text-xs font-medium">
            {slideCount > 0 ? `${slideCount} slides` : "Outline"}
          </div>
          {firstTitle && (
            <div className="truncate text-xs text-muted-foreground">
              {firstTitle}
            </div>
          )}
        </div>
      </div>
    </LabNodeCard>
  );
});
