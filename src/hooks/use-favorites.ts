"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useFavorites() {
  const trpc = useTRPC();
  return useQuery(trpc.favorite.list.queryOptions());
}

export function useAddFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.favorite.add.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newFavorite) => {
      await queryClient.cancelQueries({ queryKey: trpc.favorite.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.favorite.list.queryKey());
      queryClient.setQueryData(trpc.favorite.list.queryKey(), (old: any[] | undefined) => [
        ...(old ?? []),
        {
          ...newFavorite,
          id: `temp-${Date.now()}`,
          userId: "",
          order: (old?.length ?? 0),
          createdAt: new Date().toISOString(),
        },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.favorite.list.queryKey(), context.previous);
      }
      toast.error("Failed to add favorite");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useRemoveFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.favorite.remove.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (removedFavorite) => {
      await queryClient.cancelQueries({ queryKey: trpc.favorite.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.favorite.list.queryKey());
      queryClient.setQueryData(trpc.favorite.list.queryKey(), (old: any[] | undefined) =>
        (old ?? []).filter(
          (f: any) =>
            !(
              f.targetType === removedFavorite.targetType &&
              f.targetId === removedFavorite.targetId
            )
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.favorite.list.queryKey(), context.previous);
      }
      toast.error("Failed to remove favorite");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useReorderFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.favorite.reorder.mutationOptions();
  return useMutation({
    mutationFn,
    // Optimistic reorder is handled by the caller (NavFavorites component)
    // since the component has the reordered array ready
    onError: () => {
      toast.error("Failed to reorder favorites");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}
