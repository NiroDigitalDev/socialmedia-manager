"use client";

import { use, useState } from "react";
import {
  useTrees,
  useCreateTree,
  useDeleteTree,
} from "@/hooks/use-lab";
import { useArenas, useDeleteArena } from "@/hooks/use-arena";
import { useBrandIdentities } from "@/hooks/use-brand-identities";
import { TreeCard } from "@/components/lab/tree-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  PlusIcon,
  TreePineIcon,
  Loader2Icon,
  SwordsIcon,
  TrashIcon,
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

  // Trees
  const { data: trees, isLoading: treesLoading, isError: treesError } = useTrees(projectId);
  const { data: brandIdentities } = useBrandIdentities(projectId);
  const createTree = useCreateTree();
  const deleteTree = useDeleteTree();

  // Arenas
  const { data: arenas, isLoading: arenasLoading, isError: arenasError } = useArenas(projectId);
  const deleteArena = useDeleteArena();

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

  const handleDeleteTree = (id: string) => {
    deleteTree.mutate(
      { treeId: id },
      {
        onSuccess: () => toast.success("Tree deleted"),
        onError: (err) =>
          toast.error(err.message ?? "Failed to delete tree"),
      }
    );
  };

  const handleDeleteArena = (id: string) => {
    deleteArena.mutate(
      { arenaId: id },
      {
        onSuccess: () => toast.success("Arena deleted"),
        onError: (err) =>
          toast.error(err.message ?? "Failed to delete arena"),
      }
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Lab</h1>
      </div>

      <Tabs defaultValue="trees" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="trees">Trees</TabsTrigger>
          <TabsTrigger value="arenas">Arenas</TabsTrigger>
        </TabsList>

        {/* ── Trees tab ────────────────────────────────────── */}
        <TabsContent value="trees" className="flex flex-col gap-4 mt-0">
          <div className="flex items-center justify-end">
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

          {treesError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <p className="text-sm text-muted-foreground">
                Failed to load trees. Please try again.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {!treesError && treesLoading && (
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

          {!treesError && !treesLoading && trees && trees.length === 0 && (
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

          {!treesError && !treesLoading && trees && trees.length > 0 && (
            <div className="@container/main">
              <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
                {trees.map((tree) => (
                  <TreeCard
                    key={tree.id}
                    tree={tree}
                    projectId={projectId}
                    onDelete={handleDeleteTree}
                    isDeleting={deleteTree.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Arenas tab ───────────────────────────────────── */}
        <TabsContent value="arenas" className="flex flex-col gap-4 mt-0">
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              onClick={() =>
                router.push(`/dashboard/projects/${projectId}/lab/arena/new`)
              }
              className="gap-1.5"
            >
              <PlusIcon className="size-3.5" />
              New Arena
            </Button>
          </div>

          {arenasError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <p className="text-sm text-muted-foreground">
                Failed to load arenas. Please try again.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {!arenasError && arenasLoading && (
            <div className="@container/main">
              <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-32 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!arenasError && !arenasLoading && arenas && arenas.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <SwordsIcon className="size-8 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  No arenas yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Create an arena to start training your style through iterative rounds.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/dashboard/projects/${projectId}/lab/arena/new`)
                }
                className="gap-1.5"
              >
                <PlusIcon className="size-3.5" />
                New Arena
              </Button>
            </div>
          )}

          {!arenasError && !arenasLoading && arenas && arenas.length > 0 && (
            <div className="@container/main">
              <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
                {arenas.map((arena) => (
                  <Card
                    key={arena.id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() =>
                      router.push(
                        `/dashboard/projects/${projectId}/lab/arena/${arena.id}`
                      )
                    }
                  >
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <SwordsIcon className="size-4 shrink-0 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium truncate">
                          {arena.name}
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
                            <AlertDialogTitle>Delete arena</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{arena.name}&quot; and all
                              its rounds and entries. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteArena(arena.id);
                              }}
                              disabled={deleteArena.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {/* Source text snippet */}
                      {arena.sourceText && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {arena.sourceText.slice(0, 100)}
                          {arena.sourceText.length > 100 ? "…" : ""}
                        </p>
                      )}

                      {/* Round count + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {arena._count.rounds > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Round {arena._count.rounds}
                          </Badge>
                        )}
                        <Badge
                          variant={arena.status === "completed" ? "outline" : "default"}
                          className="text-xs"
                        >
                          {arena.status}
                        </Badge>
                      </div>

                      {/* Entry stats */}
                      {arena.entryStats && arena.entryStats.total > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {arena.entryStats.total} images
                          {arena.entryStats.up > 0 && ` · ${arena.entryStats.up} liked`}
                          {arena.entryStats.super > 0 && ` · ${arena.entryStats.super} gallery`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
