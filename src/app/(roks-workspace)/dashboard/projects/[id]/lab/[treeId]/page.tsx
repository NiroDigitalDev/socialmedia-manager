"use client";

import { use, useEffect, useMemo, useCallback } from "react";
import { useTree, useTreeProgress } from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { LabCanvas, type LabNode } from "@/components/lab/canvas";
import { LayerNav } from "@/components/lab/layer-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

export default function TreeCanvasPage({
  params,
}: {
  params: Promise<{ id: string; treeId: string }>;
}) {
  const { id: projectId, treeId } = use(params);

  const { data: tree, isLoading, isError } = useTree(treeId);
  const reset = useLabStore((s) => s.reset);

  // Determine if any nodes are currently generating for polling
  const hasGeneratingNodes = useMemo(
    () => tree?.nodes?.some((n) => n.status === "generating") ?? false,
    [tree?.nodes]
  );

  // Poll for progress when nodes are generating
  useTreeProgress(treeId, hasGeneratingNodes);

  // Reset lab store on mount/treeId change and on unmount
  useEffect(() => {
    reset();
    return () => reset();
  }, [treeId, reset]);

  // Cast via unknown to avoid "excessively deep" type instantiation from Prisma
  const nodes: LabNode[] = (tree?.nodes as unknown as LabNode[]) ?? [];

  const handleLayerClick = useCallback((_layer: string) => {
    // Canvas auto-pan/zoom to layer will be implemented when
    // reactFlowInstance is exposed from LabCanvas (Task 7+)
  }, []);

  const handleAddSource = useCallback(() => {
    // Source creation will be implemented in Task 8
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Skeleton className="size-7" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !tree) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">
          Failed to load tree. Please try again.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/projects/${projectId}/lab`}>
            <ArrowLeftIcon className="mr-1.5 size-3.5" />
            Back to Lab
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href={`/dashboard/projects/${projectId}/lab`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <h1 className="text-sm font-semibold truncate">{tree.name}</h1>
      </div>

      {/* Layer navigation */}
      <LayerNav
        nodes={nodes}
        onLayerClick={handleLayerClick}
        onAddSource={handleAddSource}
      />

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <LabCanvas nodes={nodes} treeId={treeId} />
      </div>
    </div>
  );
}
