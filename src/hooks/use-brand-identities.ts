"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useBrandIdentities(projectId: string | null | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.brandIdentity.list.queryOptions({ projectId: projectId ?? "" }),
    enabled: !!projectId,
  });
}

export function useBrandIdentity(id: string | null | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.brandIdentity.get.queryOptions({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.brandIdentity.create.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newBrand) => {
      const listKey = trpc.brandIdentity.list.queryKey({ projectId: newBrand.projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: any[] | undefined) => [
        {
          ...newBrand,
          id: `temp-${Date.now()}`,
          logoAssetId: null,
          logoR2Key: null,
          orgId: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          palettes: [],
        },
        ...(old ?? []),
      ]);
      return { previous, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error("Failed to create brand identity");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.brandIdentity.update.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (updatedBrand) => {
      const detailKey = trpc.brandIdentity.get.queryKey({ id: updatedBrand.id });
      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: trpc.brandIdentity.list.queryKey() });

      const previousDetail = queryClient.getQueryData(detailKey);

      // Optimistic update in detail cache
      queryClient.setQueryData(detailKey, (old: any) =>
        old ? { ...old, ...updatedBrand } : old
      );

      // Optimistic update in all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.brandIdentity.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((b: any) =>
            b.id === updatedBrand.id ? { ...b, ...updatedBrand } : b
          )
      );

      return { previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(
          trpc.brandIdentity.get.queryKey({ id: variables.id }),
          context.previousDetail
        );
      }
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      toast.error("Failed to update brand identity");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.get.queryKey({ id: variables.id }),
      });
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
    },
  });
}

export function useDuplicateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.brandIdentity.duplicate.mutationOptions();
  return useMutation({
    mutationFn,
    // No optimistic update -- server generates new data (id, copy name, palettes)
    onError: () => {
      toast.error("Failed to duplicate brand identity");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
    },
  });
}

export function useDeleteBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.brandIdentity.delete.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deletedBrand) => {
      await queryClient.cancelQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.brandIdentity.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      queryClient.setQueriesData(
        { queryKey: trpc.brandIdentity.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((b: any) => b.id !== deletedBrand.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete brand identity");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
    },
  });
}

export function useAddPalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.brandIdentity.addPalette.mutationOptions();
  return useMutation({
    mutationFn,
    // No optimistic update for nested data -- server generates palette id
    onError: () => {
      toast.error("Failed to add palette");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.get.queryKey() });
    },
  });
}

export function useUpdatePalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.brandIdentity.updatePalette.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (updatedPalette) => {
      await queryClient.cancelQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.brandIdentity.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      queryClient.setQueriesData(
        { queryKey: trpc.brandIdentity.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((brand: any) => ({
            ...brand,
            palettes: brand.palettes?.map((p: any) =>
              p.id === updatedPalette.paletteId ? { ...p, ...updatedPalette } : p
            ),
          }))
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to update palette");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.get.queryKey() });
    },
  });
}

export function useRemovePalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.brandIdentity.removePalette.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (removedPalette) => {
      await queryClient.cancelQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.brandIdentity.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      // Remove palette from cached brand list data
      queryClient.setQueriesData(
        { queryKey: trpc.brandIdentity.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((brand: any) => ({
            ...brand,
            palettes: brand.palettes?.filter(
              (p: any) => p.id !== removedPalette.paletteId
            ),
          }))
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to remove palette");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.get.queryKey() });
    },
  });
}
