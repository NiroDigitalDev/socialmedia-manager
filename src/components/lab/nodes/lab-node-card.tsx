"use client";

import type { ReactNode, MouseEvent } from "react";
import { Handle, Position } from "@xyflow/react";
import { Loader2Icon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
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
  childCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: ReactNode;
}

export function LabNodeCard({
  layer,
  status,
  rating,
  selected,
  childCount,
  collapsed,
  onToggleCollapse,
  children,
}: LabNodeCardProps) {
  const borderColor = LAYER_BORDER_COLORS[layer] ?? "border-border";
  const hasChildren = (childCount ?? 0) > 0;

  const handleCollapseClick = (e: MouseEvent) => {
    e.stopPropagation(); // don't trigger node selection
    onToggleCollapse?.();
  };

  return (
    <div
      className={cn(
        "relative w-[240px] rounded-lg border-2 bg-card p-3 shadow-sm transition-opacity",
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

      {/* Collapse/expand toggle for nodes with children */}
      {hasChildren && onToggleCollapse && (
        <button
          onClick={handleCollapseClick}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-full border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm hover:bg-muted transition-colors"
        >
          {collapsed ? (
            <>
              <ChevronRightIcon className="size-3" />
              <span>+{childCount}</span>
            </>
          ) : (
            <ChevronDownIcon className="size-3" />
          )}
        </button>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary"
      />
    </div>
  );
}
