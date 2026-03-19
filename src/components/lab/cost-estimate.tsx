"use client";

import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostEstimateProps {
  model: string;
  conceptCount: number;
  imageVariations: number;
  captionVariations: number;
  className?: string;
}

export function CostEstimate({
  model,
  conceptCount,
  imageVariations,
  captionVariations,
  className,
}: CostEstimateProps) {
  const imageCost =
    conceptCount *
    imageVariations *
    (model === "nano-banana-pro" ? 0.04 : 0.015);
  const captionCost = conceptCount * captionVariations * 0.001;
  const total = imageCost + captionCost;

  const timeSeconds =
    (conceptCount * imageVariations / 5) *
    (model === "nano-banana-pro" ? 5 : 3);

  const formatCost = (cost: number) =>
    cost < 0.01 ? "<$0.01" : `~$${cost.toFixed(2)}`;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      <InfoIcon className="size-3.5 shrink-0" />
      <span>
        Estimated: {formatCost(total)} &bull; {formatTime(timeSeconds)}
      </span>
    </div>
  );
}
