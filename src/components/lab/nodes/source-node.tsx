"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { FileTextIcon } from "lucide-react";
import { useLabStore } from "@/stores/use-lab-store";
import type { LabNode } from "../canvas";
import { LabNodeCard } from "./lab-node-card";

type LabFlowNode = Node<LabNode>;

export const SourceNode = memo(function SourceNode({
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const label = data.fileName ?? "Pasted text";
  const output = data.output as { text?: string } | null;
  const preview = output?.text?.slice(0, 120) ?? "";

  const collapsedIds = useLabStore((s) => s.collapsedIds);
  const toggleCollapsed = useLabStore((s) => s.toggleCollapsed);
  const isCollapsed = collapsedIds.has(data.id);

  // Count direct children from the full node list passed through canvas data
  // We use a workaround: childCount is set on the LabNode data by the canvas
  const childCount = (data as LabNode & { _childCount?: number })._childCount ?? 0;

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
      <div className="flex items-start gap-2">
        <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-xs font-medium">{label}</div>
          {preview && (
            <div className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">
              {preview}
            </div>
          )}
        </div>
      </div>
    </LabNodeCard>
  );
});
