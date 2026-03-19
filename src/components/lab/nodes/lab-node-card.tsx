"use client";

import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const LAYER_BORDER_COLORS: Record<string, string> = {
  source: "border-blue-500",
  idea: "border-green-500",
  outline: "border-yellow-500",
  image: "border-purple-500",
  caption: "border-orange-500",
};

interface LabNodeCardProps {
  layer: string;
  status: string;
  rating: "up" | "down" | null;
  selected?: boolean;
  children: ReactNode;
}

export function LabNodeCard({
  layer,
  status,
  rating,
  selected,
  children,
}: LabNodeCardProps) {
  const borderColor = LAYER_BORDER_COLORS[layer] ?? "border-border";

  return (
    <div
      className={cn(
        "relative w-[180px] rounded-lg border-2 bg-card p-3 shadow-sm transition-opacity",
        borderColor,
        rating === "up" && "bg-green-50 dark:bg-green-950/30",
        rating === "down" && "opacity-20",
        selected && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary"
      />

      {/* Status indicator */}
      {status === "generating" && (
        <div className="absolute -right-1 -top-1">
          <Loader2Icon className="size-3.5 animate-spin text-blue-500" />
        </div>
      )}
      {status === "failed" && (
        <div className="absolute -right-1 -top-1">
          <div className="size-2.5 rounded-full bg-red-500" />
        </div>
      )}

      {children}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary"
      />
    </div>
  );
}
