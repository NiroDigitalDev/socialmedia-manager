"use client";

import { use, useState } from "react";
import {
  useTrees,
  useCreateTree,
  useDeleteTree,
} from "@/hooks/use-lab";
import { useBrandIdentities } from "@/hooks/use-brand-identities";
import { TreeCard } from "@/components/lab/tree-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlusIcon,
  TreePineIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function LabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const { data: trees, isLoading, isError } = useTrees(projectId);
  const { data: brandIdentities } = useBrandIdentities(projectId);
  const createTree = useCreateTree();
  const deleteTree = useDeleteTree();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrandId, setNewBrandId] = useState<string>("");

  const resetForm = () => {
    setNewName("");
    setNewBrandId("");
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }

    createTree.mutate(
      {
        name: newName.trim(),
        projectId,
        brandIdentityId: newBrandId || undefined,
      },
      {
        onSuccess: (data) => {
          toast.success("Tree created");
          resetForm();
          setCreateOpen(false);
          router.push(
            `/dashboard/projects/${projectId}/lab/${data.id}`
          );
        },
        onError: (err) =>
          toast.error(err.message ?? "Failed to create tree"),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteTree.mutate(
      { treeId: id },
      {
        onSuccess: () => toast.success("Tree deleted"),
        onError: (err) =>
          toast.error(err.message ?? "Failed to delete tree"),
      }
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lab</h1>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="gap-1.5"
        >
          <PlusIcon className="size-3.5" />
          New Tree
        </Button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-muted-foreground">
            Failed to load trees. Please try again.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading skeleton grid */}
      {!isError && isLoading && (
        <div className="@container/main">
          <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isError && !isLoading && trees && trees.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <TreePineIcon className="size-8 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No trees yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Create one to start building content generation pipelines.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            className="gap-1.5"
          >
            <PlusIcon className="size-3.5" />
            New Tree
          </Button>
        </div>
      )}

      {/* Tree cards grid */}
      {!isError && !isLoading && trees && trees.length > 0 && (
        <div className="@container/main">
          <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
            {trees.map((tree) => (
              <TreeCard
                key={tree.id}
                tree={tree}
                projectId={projectId}
                onDelete={handleDelete}
                isDeleting={deleteTree.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Tree Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Tree</DialogTitle>
            <DialogDescription>
              Create a tree to build content generation pipelines from sources to
              posts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="tree-name">Name</Label>
              <Input
                id="tree-name"
                placeholder="e.g. Q1 Campaign"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    handleCreate();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tree-brand">
                Brand Identity{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select value={newBrandId} onValueChange={setNewBrandId}>
                <SelectTrigger id="tree-brand">
                  <SelectValue placeholder="Select a brand identity" />
                </SelectTrigger>
                <SelectContent>
                  {brandIdentities?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                  {(!brandIdentities || brandIdentities.length === 0) && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No brand identities found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createTree.isPending || !newName.trim()}
                className="flex-1 gap-1.5"
              >
                {createTree.isPending && (
                  <Loader2Icon className="size-3.5 animate-spin" />
                )}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
