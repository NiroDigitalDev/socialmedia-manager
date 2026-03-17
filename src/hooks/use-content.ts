"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useSources(projectId?: string) {
  const trpc = useTRPC();
  return useQuery(trpc.content.listSources.queryOptions({ projectId }));
}

export function useCreateSource() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.content.createSource.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newSource) => {
      const listKey = trpc.content.listSources.queryKey({ projectId: newSource.projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: any[] | undefined) => [
        {
          ...newSource,
          id: `temp-${Date.now()}`,
          orgId: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { ideas: 0 },
        },
        ...(old ?? []),
      ]);
      return { previous, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error("Failed to create content source");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.content.listSources.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useDeleteSource() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.content.deleteSource.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deletedSource) => {
      await queryClient.cancelQueries({ queryKey: trpc.content.listSources.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.content.listSources.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      queryClient.setQueriesData(
        { queryKey: trpc.content.listSources.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((s: any) => s.id !== deletedSource.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete content source");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.content.listSources.queryKey() });
      // Also invalidate ideas since deleting a source cascades
      queryClient.invalidateQueries({ queryKey: trpc.content.listIdeas.queryKey() });
    },
  });
}

export function useIdeas(filters?: {
  projectId?: string;
  sourceId?: string;
  contentType?: string;
  isSaved?: boolean;
  campaignId?: string;
}) {
  const trpc = useTRPC();
  return useQuery(trpc.content.listIdeas.queryOptions(filters ?? {}));
}

export function useToggleIdeaSave() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.content.toggleIdeaSave.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (toggledIdea) => {
      await queryClient.cancelQueries({ queryKey: trpc.content.listIdeas.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.content.listIdeas.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      // Optimistic toggle of isSaved in all idea list caches
      queryClient.setQueriesData(
        { queryKey: trpc.content.listIdeas.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((idea: any) =>
            idea.id === toggledIdea.id
              ? { ...idea, isSaved: !idea.isSaved }
              : idea
          )
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to update idea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.content.listIdeas.queryKey() });
    },
  });
}

export function useBulkDeleteIdeas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.content.bulkDeleteIdeas.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deletedIdeas) => {
      await queryClient.cancelQueries({ queryKey: trpc.content.listIdeas.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.content.listIdeas.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      const deletedIds = new Set(deletedIdeas.ids);
      queryClient.setQueriesData(
        { queryKey: trpc.content.listIdeas.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((idea: any) => !deletedIds.has(idea.id))
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete ideas");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.content.listIdeas.queryKey() });
      // Also invalidate sources since idea count may change
      queryClient.invalidateQueries({ queryKey: trpc.content.listSources.queryKey() });
    },
  });
}

export function useGenerateIdeas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.content.generateIdeas.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      toast.success(`Generated ${data.count} ideas`);
    },
    onError: () => {
      toast.error("Failed to generate content ideas");
    },
    onSettled: () => {
      // Invalidate both sources (idea count changed) and ideas list
      queryClient.invalidateQueries({
        queryKey: trpc.content.listSources.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.content.listIdeas.queryKey(),
      });
    },
  });
}
