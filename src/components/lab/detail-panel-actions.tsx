"use client";

import { CopyIcon, Trash2Icon, UploadIcon, RefreshCwIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  useRateNode,
  useDuplicateNode,
  useDeleteNode,
  useGenerateIdeas,
  useGenerateOutlines,
  useGenerateImages,
  useGenerateCaptions,
  useExportToGallery,
} from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { ThumbsRating } from "./thumbs-rating";
import { GeneratePopover } from "./generate-popover";
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

// ── Helpers ──────────────────────────────────────────────────────

function getOutputText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && "text" in output) {
    return String((output as Record<string, unknown>).text ?? "");
  }
  return "";
}

/** Check if a caption node qualifies as an exportable post */
function isExportablePost(node: LabNode, allNodes: LabNode[]): boolean {
  if (node.layer !== "caption") return false;
  if (node.status !== "completed") return false;
  if (!getOutputText(node.output)) return false;
  if (!node.parentId) return false;

  const parent = allNodes.find((n) => n.id === node.parentId);
  if (!parent) return false;
  if (parent.status !== "completed") return false;
  if (!parent.r2Key) return false;

  return true;
}

interface DetailPanelActionsProps {
  node: LabNode;
  treeId: string;
  allNodes: LabNode[];
  projectId?: string;
}

export function DetailPanelActions({ node, treeId, allNodes, projectId }: DetailPanelActionsProps) {
  const selectNode = useLabStore((s) => s.selectNode);

  const rateNode = useRateNode();
  const duplicateNode = useDuplicateNode();
  const deleteNode = useDeleteNode();
  const generateIdeas = useGenerateIdeas();
  const generateOutlines = useGenerateOutlines();
  const generateImages = useGenerateImages();
  const generateCaptions = useGenerateCaptions();
  const exportToGallery = useExportToGallery();

  const nextLayerName = NEXT_LAYER[node.layer];

  const handleRate = (rating: "up" | "down", comment?: string) => {
    rateNode.mutate(
      { nodeId: node.id, rating, comment },
      {
        onSuccess: () => {
          toast.success(`Rated ${rating === "up" ? "thumbs up" : "thumbs down"}`);
        },
      }
    );
  };

  const handleDuplicate = () => {
    duplicateNode.mutate(
      { nodeId: node.id },
      {
        onSuccess: () => {
          toast.success("Node duplicated");
        },
      }
    );
  };

  const handleDelete = () => {
    selectNode(null);
    deleteNode.mutate(
      { nodeId: node.id },
      {
        onSuccess: () => {
          toast.success("Node deleted");
        },
      }
    );
  };

  const handleGenerate = (count: number, options?: { imageStyleIds?: string[]; captionStyleId?: string }) => {
    const layer = node.layer;

    if (layer === "source") {
      generateIdeas.mutate(
        { sourceNodeId: node.id, count },
        { onSuccess: () => toast.success(`Generating ${count} ideas...`) }
      );
    } else if (layer === "idea") {
      const styleIds = options?.imageStyleIds;
      if (styleIds && styleIds.length > 0) {
        // Fan out: one call per image style
        for (const imageStyleId of styleIds) {
          generateOutlines.mutate(
            { ideaNodeId: node.id, count, imageStyleId, captionStyleId: options?.captionStyleId },
          );
        }
        toast.success(`Generating ${count * styleIds.length} outlines across ${styleIds.length} styles...`);
      } else {
        generateOutlines.mutate(
          { ideaNodeId: node.id, count, captionStyleId: options?.captionStyleId },
          { onSuccess: () => toast.success(`Generating ${count} outlines...`) }
        );
      }
    } else if (layer === "outline") {
      generateImages.mutate(
        { outlineNodeId: node.id, count },
        { onSuccess: () => toast.success(`Generating ${count} images...`) }
      );
    } else if (layer === "image") {
      generateCaptions.mutate(
        { imageNodeId: node.id, count },
        { onSuccess: () => toast.success(`Generating ${count} captions...`) }
      );
    }
  };

  const isGenerating =
    generateIdeas.isPending ||
    generateOutlines.isPending ||
    generateImages.isPending ||
    generateCaptions.isPending;

  const canExport = isExportablePost(node, allNodes);

  const handleExport = () => {
    exportToGallery.mutate({ posts: [{ captionNodeId: node.id }], projectId });
  };

  const handleRetry = () => {
    if (!node.parentId) return;

    const parent = allNodes.find((n) => n.id === node.parentId);
    if (!parent) return;

    // Re-generate from the parent based on parent's layer
    if (parent.layer === "source") {
      generateIdeas.mutate(
        { sourceNodeId: parent.id, count: 1 },
        { onSuccess: () => toast.success("Retrying generation...") },
      );
    } else if (parent.layer === "idea") {
      generateOutlines.mutate(
        { ideaNodeId: parent.id, count: 1 },
        { onSuccess: () => toast.success("Retrying generation...") },
      );
    } else if (parent.layer === "outline") {
      generateImages.mutate(
        { outlineNodeId: parent.id, count: 1 },
        { onSuccess: () => toast.success("Retrying generation...") },
      );
    } else if (parent.layer === "image") {
      generateCaptions.mutate(
        { imageNodeId: parent.id, count: 1 },
        { onSuccess: () => toast.success("Retrying generation...") },
      );
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Actions
      </h3>

      {/* Rating — skip for source nodes */}
      {node.layer !== "source" && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Rating</span>
          <ThumbsRating value={node.rating} onRate={handleRate} />
        </div>
      )}

      {/* Export to Gallery (caption nodes that qualify as posts) */}
      {canExport && (
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={handleExport}
          disabled={exportToGallery.isPending}
        >
          {exportToGallery.isPending ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <UploadIcon className="mr-1.5 size-3.5" />
          )}
          Export to Gallery
        </Button>
      )}

      {/* Retry for failed nodes */}
      {node.status === "failed" && node.parentId && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleRetry}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="mr-1.5 size-3.5" />
          )}
          Retry Generation
        </Button>
      )}

      {/* Generate next layer (not for captions) */}
      {nextLayerName && (
        <GeneratePopover
          onGenerate={handleGenerate}
          defaultCount={DEFAULT_COUNTS[node.layer] ?? 3}
          nextLayerName={nextLayerName}
          isGenerating={isGenerating}
          showStylePickers={node.layer === "idea"}
        />
      )}

      {/* Duplicate & Delete */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleDuplicate}
          disabled={duplicateNode.isPending}
        >
          <CopyIcon className="mr-1.5 size-3.5" />
          Duplicate
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:text-destructive"
              disabled={deleteNode.isPending}
            >
              <Trash2Icon className="mr-1.5 size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete node?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this node and all its children.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
