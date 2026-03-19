"use client";

import { useState, useMemo } from "react";
import { SparklesIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenerateBatch } from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { toast } from "sonner";
import type { LabNode } from "./canvas";

const NEXT_LAYER: Record<string, string> = {
  source: "Ideas",
  idea: "Outlines",
  outline: "Images",
  image: "Captions",
};

const DEFAULT_COUNTS: Record<string, number> = {
  source: 5,
  idea: 3,
  outline: 3,
  image: 3,
};

interface FloatingActionBarProps {
  treeId: string;
  nodes: LabNode[];
}

export function FloatingActionBar({ treeId, nodes }: FloatingActionBarProps) {
  const multiSelectIds = useLabStore((s) => s.multiSelectIds);
  const clearMultiSelect = useLabStore((s) => s.clearMultiSelect);
  const generateBatch = useGenerateBatch();

  // Determine the layer of selected nodes
  const selectedNodes = useMemo(
    () => nodes.filter((n) => multiSelectIds.includes(n.id)),
    [nodes, multiSelectIds],
  );

  const selectedLayer = useMemo(() => {
    if (selectedNodes.length === 0) return null;
    const layers = new Set(selectedNodes.map((n) => n.layer));
    if (layers.size !== 1) return null; // mixed layers
    return selectedNodes[0].layer;
  }, [selectedNodes]);

  const nextLayerName = selectedLayer ? NEXT_LAYER[selectedLayer] : null;
  const defaultCount = selectedLayer ? (DEFAULT_COUNTS[selectedLayer] ?? 3) : 3;
  const [count, setCount] = useState(defaultCount);

  // Don't render if nothing selected
  if (multiSelectIds.length === 0) return null;

  const isMixedLayers = selectedLayer === null && selectedNodes.length > 0;
  const isTerminalLayer = selectedLayer === "caption";

  const handleGenerate = () => {
    if (!nextLayerName) return;

    generateBatch.mutate(
      { nodeIds: multiSelectIds, count },
      {
        onSuccess: () => {
          toast.success(
            `Generating ${count} ${nextLayerName.toLowerCase()} for ${multiSelectIds.length} node${multiSelectIds.length === 1 ? "" : "s"}...`,
          );
          clearMultiSelect();
        },
      },
    );
  };

  return (
    <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {/* Selection count */}
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {multiSelectIds.length} selected
        </span>

        {/* Generate controls */}
        {isMixedLayers ? (
          <span className="text-xs text-muted-foreground">
            Select nodes from the same layer to generate
          </span>
        ) : isTerminalLayer ? (
          <span className="text-xs text-muted-foreground">
            Captions are the final layer
          </span>
        ) : nextLayerName ? (
          <>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="h-7 w-14 text-center"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                per node
              </span>
            </div>
            <Button
              size="sm"
              disabled={generateBatch.isPending || count < 1}
              onClick={handleGenerate}
            >
              {generateBatch.isPending ? (
                <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="mr-1.5 size-3.5" />
              )}
              Generate {nextLayerName}
            </Button>
          </>
        ) : null}

        {/* Clear selection */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={clearMultiSelect}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
