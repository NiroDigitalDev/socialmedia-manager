"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

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
  return useMutation({
    ...trpc.campaign.create.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.get.queryKey({ id: variables.id }),
      });
    },
  });
}

export function useDeleteCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
