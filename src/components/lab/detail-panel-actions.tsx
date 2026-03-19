"use client";

import { CopyIcon, Trash2Icon } from "lucide-react";
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

interface DetailPanelActionsProps {
  node: LabNode;
  treeId: string;
}

export function DetailPanelActions({ node, treeId }: DetailPanelActionsProps) {
  const selectNode = useLabStore((s) => s.selectNode);

  const rateNode = useRateNode();
  const duplicateNode = useDuplicateNode();
  const deleteNode = useDeleteNode();
  const generateIdeas = useGenerateIdeas();
  const generateOutlines = useGenerateOutlines();
  const generateImages = useGenerateImages();
  const generateCaptions = useGenerateCaptions();

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

  const handleGenerate = (count: number) => {
    const layer = node.layer;

    if (layer === "source") {
      generateIdeas.mutate(
        { sourceNodeId: node.id, count },
        { onSuccess: () => toast.success(`Generating ${count} ideas...`) }
      );
    } else if (layer === "idea") {
      generateOutlines.mutate(
        { ideaNodeId: node.id, count },
        { onSuccess: () => toast.success(`Generating ${count} outlines...`) }
      );
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

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Actions
      </h3>

      {/* Rating */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Rating</span>
        <ThumbsRating value={node.rating} onRate={handleRate} />
      </div>

      {/* Generate next layer (not for captions) */}
      {nextLayerName && (
        <GeneratePopover
          onGenerate={handleGenerate}
          defaultCount={DEFAULT_COUNTS[node.layer] ?? 3}
          nextLayerName={nextLayerName}
          isGenerating={isGenerating}
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
