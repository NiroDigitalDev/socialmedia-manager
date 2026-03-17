"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useAssets(opts?: {
  projectId?: string | null;
  category?: "reference" | "asset";
}) {
  const trpc = useTRPC();
  return useQuery(
    trpc.asset.list.queryOptions({
      projectId: opts?.projectId ?? undefined,
      category: opts?.category,
    })
  );
}

export function useMoveAsset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.asset.move.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (movedAsset) => {
      await queryClient.cancelQueries({ queryKey: trpc.asset.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.asset.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      // Optimistic update: change projectId in all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.asset.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((a: any) =>
            a.id === movedAsset.id
              ? { ...a, projectId: movedAsset.projectId }
              : a
          )
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to move asset");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}

export function useDeleteAsset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.asset.delete.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deletedAsset) => {
      await queryClient.cancelQueries({ queryKey: trpc.asset.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.asset.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      queryClient.setQueriesData(
        { queryKey: trpc.asset.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((a: any) => a.id !== deletedAsset.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete asset");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}

// Upload uses REST route, not tRPC
export function useUploadAsset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      file: File;
      category: "reference" | "asset";
      projectId?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", params.file);
      formData.append("category", params.category);
      if (params.projectId) formData.append("projectId", params.projectId);
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      return res.json();
    },
    // No optimistic update for upload -- we don't have the r2Key until server responds
    onError: () => {
      toast.error("Failed to upload asset");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}
