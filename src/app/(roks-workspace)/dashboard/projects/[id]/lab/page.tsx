"use client";

import { use, useState } from "react";
import {
  useExperiments,
  useCreateExperiment,
  useDeleteExperiment,
} from "@/hooks/use-lab";
import { useBrandIdentities } from "@/hooks/use-brand-identities";
import { ExperimentCard } from "@/components/lab/experiment-card";
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
  TestTubeDiagonalIcon,
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

  const { data: experiments, isLoading, isError } = useExperiments(projectId);
  const { data: brandIdentities } = useBrandIdentities(projectId);
  const createExperiment = useCreateExperiment();
  const deleteExperiment = useDeleteExperiment();

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

    createExperiment.mutate(
      {
        name: newName.trim(),
        projectId,
        brandIdentityId: newBrandId || undefined,
      },
      {
        onSuccess: (data) => {
          toast.success("Experiment created");
          resetForm();
          setCreateOpen(false);
          router.push(
            `/dashboard/projects/${projectId}/lab/${data.id}`
          );
        },
        onError: (err) =>
          toast.error(err.message ?? "Failed to create experiment"),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteExperiment.mutate(
      { id },
      {
        onSuccess: () => toast.success("Experiment deleted"),
        onError: (err) =>
          toast.error(err.message ?? "Failed to delete experiment"),
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
          New Experiment
        </Button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-muted-foreground">
            Failed to load experiments. Please try again.
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
      {!isError && !isLoading && experiments && experiments.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <TestTubeDiagonalIcon className="size-8 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No experiments yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Create one to start testing different content and style
              combinations.
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
            New Experiment
          </Button>
        </div>
      )}

      {/* Experiment cards grid */}
      {!isError && !isLoading && experiments && experiments.length > 0 && (
        <div className="@container/main">
          <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
            {experiments.map((experiment) => (
              <ExperimentCard
                key={experiment.id}
                experiment={experiment}
                projectId={projectId}
                onDelete={handleDelete}
                isDeleting={deleteExperiment.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Experiment Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Experiment</DialogTitle>
            <DialogDescription>
              Create an experiment to test different content and style
              combinations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="experiment-name">Name</Label>
              <Input
                id="experiment-name"
                placeholder="e.g. Q1 Campaign Test"
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
              <Label htmlFor="experiment-brand">
                Brand Identity{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select value={newBrandId} onValueChange={setNewBrandId}>
                <SelectTrigger id="experiment-brand">
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
                disabled={createExperiment.isPending || !newName.trim()}
                className="flex-1 gap-1.5"
              >
                {createExperiment.isPending && (
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
