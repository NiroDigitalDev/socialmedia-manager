"use client";

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import type { LabNode } from "../canvas";
import { LabNodeCard } from "./lab-node-card";

type LabFlowNode = Node<LabNode>;

const R2_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

export const ImageNode = memo(function ImageNode({
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const imageUrl = data.r2Key && R2_URL ? `${R2_URL}/${data.r2Key}` : null;

  return (
    <LabNodeCard
      layer={data.layer}
      status={data.status}
      rating={data.rating}
      selected={selected}
    >
      <div className="flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Generated"
            className="h-14 w-full rounded object-cover"
          />
        ) : (
          <div className="flex h-14 w-full items-center justify-center rounded bg-muted">
            <ImageIcon className="size-6 text-purple-400" />
          </div>
        )}
      </div>
    </LabNodeCard>
  );
});
