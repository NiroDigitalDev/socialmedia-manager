"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { TreePineIcon, CalendarIcon, TrashIcon } from "lucide-react";

interface TreeCardProps {
  tree: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    layerCounts: Record<string, number>;
    _count: { nodes: number };
  };
  projectId: string;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

const LAYER_LABELS: Record<string, string> = {
  source: "Sources",
  idea: "Ideas",
  outline: "Outlines",
  image: "Images",
  caption: "Captions",
};

const LAYER_ORDER = ["source", "idea", "outline", "image", "caption"];

export function TreeCard({
  tree,
  projectId,
  onDelete,
  isDeleting,
}: TreeCardProps) {
  const router = useRouter();

  const formattedDate = new Date(tree.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() =>
        router.push(`/dashboard/projects/${projectId}/lab/${tree.id}`)
      }
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <TreePineIcon className="size-4 shrink-0 text-muted-foreground" />
          <CardTitle className="text-sm font-medium truncate">
            {tree.name}
          </CardTitle>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => e.stopPropagation()}
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete tree</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{tree.name}&quot; and all its
                nodes. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(tree.id);
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent>
        {/* Layer count badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {LAYER_ORDER.map((layer) => {
            const count = tree.layerCounts[layer];
            if (!count) return null;
            return (
              <Badge key={layer} variant="secondary" className="text-xs">
                {LAYER_LABELS[layer] ?? layer} {count}
              </Badge>
            );
          })}
          {tree._count.nodes === 0 && (
            <span className="text-xs text-muted-foreground">No nodes yet</span>
          )}
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="size-3" />
          {formattedDate}
        </div>
      </CardContent>
    </Card>
  );
}
