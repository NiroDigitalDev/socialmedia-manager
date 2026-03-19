"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

// ── Queries ────────────────────────────────────────────────────────

export function useTrees(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.lab.listTrees.queryOptions({ projectId }));
}

export function useTree(treeId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.lab.getTree.queryOptions({ treeId: treeId! }),
    enabled: !!treeId,
  });
}

export function useTreeProgress(treeId: string | undefined, enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.lab.treeProgress.queryOptions({ treeId: treeId! }),
    enabled: !!treeId && enabled,
    refetchInterval: enabled ? 2000 : false,
  });
}

// ── Tree Mutations ────────────────────────────────────────────────

export function useCreateTree() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.createTree.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newTree) => {
      const queryKey = trpc.lab.listTrees.queryKey({
        projectId: newTree.projectId,
      });
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => [
        {
          ...newTree,
          id: `temp-${Date.now()}`,
          orgId: "temp",
          brandIdentityId: newTree.brandIdentityId ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { nodes: 0 },
          layerCounts: {},
        },
        ...(old ?? []),
      ]);
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error("Failed to create tree");
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.listTrees.queryKey({
          projectId: vars.projectId,
        }),
      });
    },
  });
}

export function useUpdateTree() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.updateTree.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.listTrees.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to update tree");
    },
  });
}

export function useDeleteTree() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.deleteTree.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deleted) => {
      // We don't know projectId here so search all cached listTrees queries
      const allQueries = queryClient.getQueriesData<any[]>({
        queryKey: trpc.lab.listTrees.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any[]>();
      for (const [key, data] of allQueries) {
        if (data) {
          previousMap.set(key, data);
          queryClient.setQueryData(
            key,
            data.filter((t: any) => t.id !== deleted.treeId)
          );
        }
      }
      return { previousMap };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMap) {
        for (const [key, data] of context.previousMap) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to delete tree");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.listTrees.queryKey(),
      });
    },
  });
}

// ── Node Mutations ────────────────────────────────────────────────

export function useCreateSourceNode() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.createSourceNode.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey({ treeId: vars.treeId }),
      });
    },
    onError: () => {
      toast.error("Failed to create source node");
    },
  });
}

export function useUpdateNode() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.updateNode.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      // We don't know treeId here; invalidate all getTree queries
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to update node");
    },
  });
}

export function useDuplicateNode() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.duplicateNode.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to duplicate node");
    },
  });
}

export function useDeleteNode() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.deleteNode.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deleted) => {
      // Optimistic removal from all cached getTree queries
      const allQueries = queryClient.getQueriesData<any>({
        queryKey: trpc.lab.getTree.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any>();
      for (const [key, data] of allQueries) {
        if (!data?.nodes) continue;
        previousMap.set(key, data);

        // Collect all descendant IDs (nodes whose parentId chain leads to the deleted node)
        const removedIds = new Set<string>([deleted.nodeId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const node of data.nodes as any[]) {
            if (!removedIds.has(node.id) && node.parentId && removedIds.has(node.parentId)) {
              removedIds.add(node.id);
              changed = true;
            }
          }
        }

        queryClient.setQueryData(key, {
          ...data,
          nodes: (data.nodes as any[]).filter(
            (n: any) => !removedIds.has(n.id)
          ),
        });
      }
      return { previousMap };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMap) {
        for (const [key, data] of context.previousMap) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to delete node");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
  });
}

export function useRateNode() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.rateNode.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      // Optimistic rating update on all cached getTree queries
      const allQueries = queryClient.getQueriesData<any>({
        queryKey: trpc.lab.getTree.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any>();
      for (const [key, data] of allQueries) {
        if (!data?.nodes) continue;
        previousMap.set(key, data);
        queryClient.setQueryData(key, {
          ...data,
          nodes: (data.nodes as any[]).map((n: any) =>
            n.id === vars.nodeId
              ? { ...n, rating: vars.rating, ratingComment: vars.comment ?? null }
              : n
          ),
        });
      }
      return { previousMap };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMap) {
        for (const [key, data] of context.previousMap) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to rate node");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
  });
}

// ── Generation Mutations ──────────────────────────────────────────

export function useGenerateIdeas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.generateIdeas.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate ideas");
    },
  });
}

export function useGenerateOutlines() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.generateOutlines.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate outlines");
    },
  });
}

export function useGenerateImages() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.generateImages.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate images");
    },
  });
}

export function useGenerateCaptions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.generateCaptions.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate captions");
    },
  });
}

export function useGenerateBatch() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.generateBatch.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate batch");
    },
  });
}

// ── Cancel Generation ─────────────────────────────────────────────

export function useCancelGeneration() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.cancelGeneration.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getTree.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to cancel generation");
    },
  });
}

// ── AI Prompt Tweaking ────────────────────────────────────────────

export function useTweakPrompt() {
  const trpc = useTRPC();
  const { mutationFn } = trpc.lab.tweakPrompt.mutationOptions();
  return useMutation({
    mutationFn,
    onError: () => {
      toast.error("Failed to tweak prompt");
    },
  });
}

// ── Export to Gallery ─────────────────────────────────────────────

export function useExportToGallery() {
  const trpc = useTRPC();
  const { mutationFn } = trpc.lab.exportToGallery.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      toast.success(
        `Exported ${data.postIds.length} post${data.postIds.length === 1 ? "" : "s"} to gallery`
      );
    },
    onError: () => {
      toast.error("Failed to export to gallery");
    },
  });
}
