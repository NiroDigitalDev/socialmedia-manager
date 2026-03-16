"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useBrandIdentities(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.brandIdentity.list.queryOptions({ projectId }));
}

export function useBrandIdentity(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.brandIdentity.get.queryOptions({ id }));
}

export function useCreateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.create.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.get.queryKey({ id: variables.id }),
      });
    },
  });
}

export function useDuplicateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.duplicate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useAddPalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.addPalette.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useRemovePalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.removePalette.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
