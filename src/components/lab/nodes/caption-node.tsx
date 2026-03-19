"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { TypeIcon } from "lucide-react";
import type { LabNode } from "../canvas";
import { LabNodeCard } from "./lab-node-card";

type LabFlowNode = Node<LabNode>;

export const CaptionNode = memo(function CaptionNode({
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const output = data.output;
  let preview = "";
  if (typeof output === "string") {
    preview = output.slice(0, 40);
  } else if (output && typeof output === "object" && "text" in output) {
    preview = ((output as { text?: string }).text ?? "").slice(0, 40);
  }

  return (
    <LabNodeCard
      layer={data.layer}
      status={data.status}
      rating={data.rating}
      selected={selected}
    >
      <div className="flex items-start gap-1.5">
        <TypeIcon className="mt-0.5 size-3.5 shrink-0 text-orange-500" />
        <div className="min-w-0">
          <div className="text-xs font-medium">Caption</div>
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
