"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlusIcon, ChevronRightIcon } from "lucide-react";
import { useLabStore } from "@/stores/use-lab-store";
import type { LabNode } from "@/components/lab/canvas";

interface LayerNavProps {
  nodes: LabNode[];
  onLayerClick: (layer: string) => void;
  onAddSource: () => void;
}

const LAYERS = [
  { key: "source", label: "Sources" },
  { key: "idea", label: "Ideas" },
  { key: "outline", label: "Outlines" },
  { key: "image", label: "Images" },
  { key: "caption", label: "Captions" },
  { key: "post", label: "Posts" },
] as const;

export function LayerNav({ nodes, onLayerClick, onAddSource }: LayerNavProps) {
  const showHidden = useLabStore((s) => s.showHidden);
  const toggleShowHidden = useLabStore((s) => s.toggleShowHidden);

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      counts[node.layer] = (counts[node.layer] ?? 0) + 1;
    }

    // Derive post count: caption nodes that are completed AND have a completed image parent
    const completedCaptionIds = nodes.filter(
      (n) => n.layer === "caption" && n.status === "completed"
    );
    const completedImageIds = new Set(
      nodes
        .filter((n) => n.layer === "image" && n.status === "completed")
        .map((n) => n.id)
    );
    counts["post"] = completedCaptionIds.filter(
      (c) => c.parentId && completedImageIds.has(c.parentId)
    ).length;

    return counts;
  }, [nodes]);

  return (
    <div className="flex items-center gap-1 border-b bg-background px-4 py-2 overflow-x-auto">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 shrink-0"
        onClick={onAddSource}
      >
        <PlusIcon className="size-3.5" />
        Add Source
      </Button>

      <div className="mx-2 h-4 w-px bg-border shrink-0" />

      {LAYERS.map((layer, index) => (
        <div key={layer.key} className="flex items-center gap-1 shrink-0">
          {index > 0 && (
            <ChevronRightIcon className="size-3 text-muted-foreground/50 shrink-0" />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onLayerClick(layer.key)}
          >
            {layer.label}
            <Badge
              variant="secondary"
              className="ml-0.5 min-w-5 justify-center px-1 text-xs"
            >
              {layerCounts[layer.key] ?? 0}
            </Badge>
          </Button>
        </div>
      ))}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <Switch
          id="show-hidden"
          checked={showHidden}
          onCheckedChange={toggleShowHidden}
        />
        <Label htmlFor="show-hidden" className="text-xs cursor-pointer">
          Show hidden
        </Label>
      </div>
    </div>
  );
}
