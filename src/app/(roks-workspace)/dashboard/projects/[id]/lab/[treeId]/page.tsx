"use client";

import { use, useState, useEffect, useMemo, useCallback } from "react";
import { useTree, useTreeProgress } from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { LabCanvas, type LabNode } from "@/components/lab/canvas";
import { LayerNav } from "@/components/lab/layer-nav";
import { DetailPanel } from "@/components/lab/detail-panel";
import { SourceUploadDialog } from "@/components/lab/source-upload-dialog";
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
  const selectedNodeId = useLabStore((s) => s.selectedNodeId);
  const reset = useLabStore((s) => s.reset);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);

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
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleLayerClick = useCallback((_layer: string) => {
    // Canvas auto-pan/zoom to layer will be implemented when
    // reactFlowInstance is exposed from LabCanvas (Task 7+)
  }, []);

  const handleAddSource = useCallback(() => {
    setSourceDialogOpen(true);
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

      {/* Canvas + Detail Panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <LabCanvas nodes={nodes} treeId={treeId} />
        </div>
        {selectedNode && (
          <div className="w-[400px] border-l">
            <DetailPanel node={selectedNode} treeId={treeId} />
          </div>
        )}
      </div>

      {/* Source upload dialog */}
      <SourceUploadDialog
        open={sourceDialogOpen}
        onOpenChange={setSourceDialogOpen}
        treeId={treeId}
        projectId={projectId}
      />
    </div>
  );
}
