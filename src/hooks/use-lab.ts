"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

// ── Queries ────────────────────────────────────────────────────────

export function useExperiments(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.lab.listExperiments.queryOptions({ projectId }));
}

export function useExperiment(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.lab.getExperiment.queryOptions({ id: id! }),
    enabled: !!id,
    // Re-fetch while any run is in a transient status so sidebar badges update
    refetchInterval: (query) => {
      const runs = (query.state.data as { runs?: { status: string }[] } | undefined)?.runs;
      const hasGenerating = runs?.some((r) => r.status === "generating");
      return hasGenerating ? 5000 : false;
    },
  });
}

export function useRun(runId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.lab.getRun.queryOptions({ runId: runId! }),
    enabled: !!runId,
    // Re-fetch periodically while the run is in a transient state so the UI
    // picks up status changes (configuring -> generating -> completed/failed).
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status === "generating" ? 3000 : false;
    },
  });
}

export function useRunConcepts(
  runId: string | undefined,
  conceptId?: string,
  pollWhileGenerating?: boolean
) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.lab.getRunConcepts.queryOptions({ runId: runId!, conceptId }),
    enabled: !!runId,
    refetchInterval: pollWhileGenerating ? 3000 : false,
  });
}

export function useRunProgress(runId: string | undefined, enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.lab.runProgress.queryOptions({ runId: runId! }),
    enabled: !!runId && enabled,
    refetchInterval: enabled ? 2000 : false,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

export function useCreateExperiment() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.createExperiment.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newExperiment) => {
      const queryKey = trpc.lab.listExperiments.queryKey({
        projectId: newExperiment.projectId,
      });
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => [
        {
          ...newExperiment,
          id: `temp-${Date.now()}`,
          orgId: "temp",
          brandIdentityId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { runs: 0 },
        },
        ...(old ?? []),
      ]);
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error("Failed to create experiment");
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.listExperiments.queryKey({
          projectId: vars.projectId,
        }),
      });
    },
  });
}

export function useDeleteExperiment() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.deleteExperiment.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deleted) => {
      // We don't know projectId here so invalidate all listExperiments queries
      // For optimistic removal, search all cached listExperiments queries
      const allQueries = queryClient.getQueriesData<any[]>({
        queryKey: trpc.lab.listExperiments.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any[]>();
      for (const [key, data] of allQueries) {
        if (data) {
          previousMap.set(key, data);
          queryClient.setQueryData(
            key,
            data.filter((e: any) => e.id !== deleted.id)
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
      toast.error("Failed to delete experiment");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.listExperiments.queryKey(),
      });
    },
  });
}

export function useCreateRun() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.createRun.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getExperiment.queryKey({
          id: vars.experimentId,
        }),
      });
    },
    onError: () => {
      toast.error("Failed to create run");
    },
  });
}

export function useUpdateRunSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.updateRunSettings.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getRun.queryKey({ runId: vars.runId }),
      });
    },
    onError: () => {
      toast.error("Failed to update run settings");
    },
  });
}

export function useStartGeneration() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.startGeneration.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getRun.queryKey({ runId: vars.runId }),
      });
    },
    onError: () => {
      toast.error("Failed to start generation");
    },
  });
}

export function useCancelRun() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.cancelRun.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      const queryKey = trpc.lab.getRun.queryKey({ runId: vars.runId });
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) =>
        old ? { ...old, status: "cancelled" } : old
      );
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error("Failed to cancel run");
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getRun.queryKey({ runId: vars.runId }),
      });
    },
  });
}

export function useRateImageVariation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.rateImageVariation.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      // Optimistic update on all getRunConcepts queries
      const allQueries = queryClient.getQueriesData<any>({
        queryKey: trpc.lab.getRunConcepts.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any>();
      for (const [key, data] of allQueries) {
        if (!data) continue;
        previousMap.set(key, data);
        if (data.type === "single" && data.concept) {
          queryClient.setQueryData(key, {
            ...data,
            concept: {
              ...data.concept,
              imageVariations: data.concept.imageVariations.map((v: any) =>
                v.id === vars.variationId
                  ? { ...v, rating: vars.rating, ratingComment: vars.comment ?? null }
                  : v
              ),
            },
          });
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
      toast.error("Failed to rate image variation");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getRunConcepts.queryKey(),
      });
    },
  });
}

export function useRateCaptionVariation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.rateCaptionVariation.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      const allQueries = queryClient.getQueriesData<any>({
        queryKey: trpc.lab.getRunConcepts.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any>();
      for (const [key, data] of allQueries) {
        if (!data) continue;
        previousMap.set(key, data);
        if (data.type === "single" && data.concept) {
          queryClient.setQueryData(key, {
            ...data,
            concept: {
              ...data.concept,
              captionVariations: data.concept.captionVariations.map((v: any) =>
                v.id === vars.variationId
                  ? { ...v, rating: vars.rating, ratingComment: vars.comment ?? null }
                  : v
              ),
            },
          });
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
      toast.error("Failed to rate caption variation");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getRunConcepts.queryKey(),
      });
    },
  });
}

export function useRerun() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.rerun.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      // New run appears in experiment's run list
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getExperiment.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to create re-run");
    },
  });
}

export function useRetryVariation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.retryVariation.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      // Optimistic status reset to "generating" on the variation
      const allQueries = queryClient.getQueriesData<any>({
        queryKey: trpc.lab.getRunConcepts.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any>();
      for (const [key, data] of allQueries) {
        if (!data) continue;
        previousMap.set(key, data);
        if (data.type === "single" && data.concept) {
          const variationKey =
            vars.type === "image" ? "imageVariations" : "captionVariations";
          queryClient.setQueryData(key, {
            ...data,
            concept: {
              ...data.concept,
              [variationKey]: data.concept[variationKey].map((v: any) =>
                v.id === vars.variationId ? { ...v, status: "generating" } : v
              ),
            },
          });
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
      toast.error("Failed to retry variation");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getRunConcepts.queryKey(),
      });
    },
  });
}

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

export function useDeleteRun() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.lab.deleteRun.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      // Optimistic removal from experiment's run list
      const allQueries = queryClient.getQueriesData<any>({
        queryKey: trpc.lab.getExperiment.queryKey(),
      });
      const previousMap = new Map<readonly unknown[], any>();
      for (const [key, data] of allQueries) {
        if (!data?.runs) continue;
        previousMap.set(key, data);
        queryClient.setQueryData(key, {
          ...data,
          runs: data.runs.filter((r: any) => r.id !== vars.runId),
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
      toast.error("Failed to delete run");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.lab.getExperiment.queryKey(),
      });
    },
  });
}
