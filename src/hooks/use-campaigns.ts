"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useCampaigns(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.campaign.list.queryOptions({ projectId }));
}

export function useCampaign(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.campaign.get.queryOptions({ id }));
}

export function useCreateCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.campaign.create.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newCampaign) => {
      const listKey = trpc.campaign.list.queryKey({ projectId: newCampaign.projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: any[] | undefined) => [
        {
          ...newCampaign,
          id: `temp-${Date.now()}`,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          brandIdentity: null,
          _count: { posts: 0, contentIdeas: 0 },
        },
        ...(old ?? []),
      ]);
      return { previous, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error("Failed to create campaign");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.campaign.update.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (updatedCampaign) => {
      const detailKey = trpc.campaign.get.queryKey({ id: updatedCampaign.id });
      await queryClient.cancelQueries({ queryKey: detailKey });
      // Also cancel any list queries (we don't know projectId here, so cancel all campaign.list)
      await queryClient.cancelQueries({ queryKey: trpc.campaign.list.queryKey() });

      const previousDetail = queryClient.getQueryData(detailKey);

      // Optimistic update in detail cache
      queryClient.setQueryData(detailKey, (old: any) =>
        old ? { ...old, ...updatedCampaign } : old
      );

      // Optimistic update in all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.campaign.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((c: any) =>
            c.id === updatedCampaign.id ? { ...c, ...updatedCampaign } : c
          )
      );

      return { previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(
          trpc.campaign.get.queryKey({ id: variables.id }),
          context.previousDetail
        );
      }
      // For list caches, just invalidate on error to restore server state
      queryClient.invalidateQueries({ queryKey: trpc.campaign.list.queryKey() });
      toast.error("Failed to update campaign");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.get.queryKey({ id: variables.id }),
      });
      queryClient.invalidateQueries({ queryKey: trpc.campaign.list.queryKey() });
    },
  });
}

export function useDeleteCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.campaign.delete.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deletedCampaign) => {
      await queryClient.cancelQueries({ queryKey: trpc.campaign.list.queryKey() });
      // We don't know projectId, so snapshot all campaign list queries
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient.getQueriesData({ queryKey: trpc.campaign.list.queryKey() }).forEach(
        ([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        }
      );

      // Remove from all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.campaign.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((c: any) => c.id !== deletedCampaign.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      // Rollback all list caches
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete campaign");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.campaign.list.queryKey() });
    },
  });
}
