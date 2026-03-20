"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { useLabStore } from "@/stores/use-lab-store";
import type { LabNode } from "../canvas";
import { LabNodeCard } from "./lab-node-card";

type LabFlowNode = Node<LabNode>;

const R2_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

export const ImageNode = memo(function ImageNode({
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const imageUrl = data.r2Key && R2_URL ? `${R2_URL}/${data.r2Key}` : null;

  const collapsedIds = useLabStore((s) => s.collapsedIds);
  const toggleCollapsed = useLabStore((s) => s.toggleCollapsed);
  const isCollapsed = collapsedIds.has(data.id);
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
      <div className="flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Generated"
            className="w-full rounded object-contain"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded bg-muted">
            <ImageIcon className="size-6 text-purple-400" />
          </div>
        )}
      </div>
    </LabNodeCard>
  );
});
