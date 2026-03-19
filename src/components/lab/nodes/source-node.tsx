"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { FileTextIcon } from "lucide-react";
import type { LabNode } from "../canvas";
import { LabNodeCard } from "./lab-node-card";

type LabFlowNode = Node<LabNode>;

export const SourceNode = memo(function SourceNode({
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const label = data.fileName ?? "Pasted text";
  const output = data.output as { text?: string } | null;
  const preview = output?.text?.slice(0, 40) ?? "";

  return (
    <LabNodeCard
      layer={data.layer}
      status={data.status}
      rating={data.rating}
      selected={selected}
    >
      <div className="flex items-start gap-1.5">
        <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{label}</div>
          {preview && (
            <div className="truncate text-xs text-muted-foreground">
              {preview}
            </div>
          )}
        </div>
      </div>
    </LabNodeCard>
  );
});
