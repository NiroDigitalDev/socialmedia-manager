"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

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
  return useMutation({
    ...trpc.asset.move.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}

export function useDeleteAsset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.asset.delete.mutationOptions(),
    onSuccess: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}
