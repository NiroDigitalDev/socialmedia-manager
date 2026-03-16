"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useFavorites() {
  const trpc = useTRPC();
  return useQuery(trpc.favorite.list.queryOptions());
}

export function useAddFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.add.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useRemoveFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.remove.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useReorderFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.reorder.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}
