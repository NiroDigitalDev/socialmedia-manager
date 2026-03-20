"use client";

import { memo, useState } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import {
  LightbulbIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  Trash2Icon,
  ListIcon,
  CopyIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useRateNode,
  useDeleteNode,
  useDuplicateNode,
  useGenerateOutlines,
} from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { toast } from "sonner";
import type { LabNode } from "../canvas";
import { LabNodeCard } from "./lab-node-card";

type LabFlowNode = Node<LabNode>;

export const IdeaNode = memo(function IdeaNode({
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const output = data.output;
  let preview = "";
  if (typeof output === "string") {
    preview = output.slice(0, 120);
  } else if (output && typeof output === "object" && "text" in output) {
    preview = ((output as { text?: string }).text ?? "").slice(0, 120);
  }

  const [genCount, setGenCount] = useState(3);
  const rateNode = useRateNode();
  const deleteNode = useDeleteNode();
  const duplicateNode = useDuplicateNode();
  const generateOutlines = useGenerateOutlines();
  const selectNode = useLabStore((s) => s.selectNode);
  const collapsedIds = useLabStore((s) => s.collapsedIds);
  const toggleCollapsed = useLabStore((s) => s.toggleCollapsed);
  const isCollapsed = collapsedIds.has(data.id);
  const childCount = (data as LabNode & { _childCount?: number })._childCount ?? 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
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
            <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-green-500" />
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-medium">Idea</div>
              {preview && (
                <div className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">
                  {preview}
                </div>
              )}
            </div>
          </div>
        </LabNodeCard>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        {/* Generate outlines */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ListIcon className="mr-2 size-3.5" />
            Generate Outlines
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="p-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={10}
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                className="h-7 w-16 text-xs"
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  generateOutlines.mutate(
                    { ideaNodeId: data.id, count: genCount },
                    { onSuccess: () => toast.success(`Generating ${genCount} outlines...`) },
                  );
                }}
              >
                Generate
              </Button>
            </div>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Rating */}
        <ContextMenuItem
          onClick={() => {
            rateNode.mutate({ nodeId: data.id, rating: "up" });
          }}
        >
          <ThumbsUpIcon className="mr-2 size-3.5 text-green-500" />
          Thumbs Up
          {data.rating === "up" && <span className="ml-auto text-green-500">✓</span>}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            rateNode.mutate({ nodeId: data.id, rating: "down" });
          }}
        >
          <ThumbsDownIcon className="mr-2 size-3.5 text-red-500" />
          Thumbs Down
          {data.rating === "down" && <span className="ml-auto text-red-500">✓</span>}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Duplicate */}
        <ContextMenuItem
          onClick={() => {
            duplicateNode.mutate(
              { nodeId: data.id },
              { onSuccess: () => toast.success("Node duplicated") },
            );
          }}
        >
          <CopyIcon className="mr-2 size-3.5" />
          Duplicate
        </ContextMenuItem>

        {/* Delete */}
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            selectNode(null);
            deleteNode.mutate(
              { nodeId: data.id },
              { onSuccess: () => toast.success("Node deleted") },
            );
          }}
        >
          <Trash2Icon className="mr-2 size-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
