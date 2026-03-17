"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useSources(projectId?: string) {
  const trpc = useTRPC();
  return useQuery(trpc.content.listSources.queryOptions({ projectId }));
}

export function useCreateSource() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.createSource.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteSource() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.deleteSource.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
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
  return useMutation({
    ...trpc.content.toggleIdeaSave.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useBulkDeleteIdeas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.bulkDeleteIdeas.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
