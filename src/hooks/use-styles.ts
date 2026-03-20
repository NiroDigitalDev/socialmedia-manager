"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useStyles() {
  const trpc = useTRPC();
  return useQuery(trpc.style.list.queryOptions());
}

export function useStyle(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.style.get.queryOptions({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateStyle() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.style.create.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newStyle) => {
      await queryClient.cancelQueries({ queryKey: trpc.style.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.style.list.queryKey());
      queryClient.setQueryData(trpc.style.list.queryKey(), (old: any) => [
        {
          ...newStyle,
          id: `temp-${Date.now()}`,
          isPredefined: false,
          orgId: "temp",
          sampleImageIds: [],
          sampleImageUrls: [],
          referenceImageId: null,
          referenceImageUrl: null,
          createdAt: new Date().toISOString(),
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(trpc.style.list.queryKey(), context.previous);
      }
      toast.error("Failed to create style");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
    },
  });
}

export function useUpdateStyle() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.style.update.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (updatedStyle) => {
      await queryClient.cancelQueries({ queryKey: trpc.style.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.style.list.queryKey());
      queryClient.setQueryData(trpc.style.list.queryKey(), (old: any) =>
        (old ?? []).map((s: any) =>
          s.id === updatedStyle.id ? { ...s, ...updatedStyle } : s
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(trpc.style.list.queryKey(), context.previous);
      }
      toast.error("Failed to update style");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
    },
  });
}

export function useDeleteStyle() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.style.delete.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deletedStyle) => {
      await queryClient.cancelQueries({ queryKey: trpc.style.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.style.list.queryKey());
      queryClient.setQueryData(trpc.style.list.queryKey(), (old: any) =>
        (old ?? []).filter((s: any) => s.id !== deletedStyle.id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(trpc.style.list.queryKey(), context.previous);
      }
      toast.error("Failed to delete style");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
    },
  });
}

export function useGenerateStylePreview() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.generatePreview.mutationOptions(),
    onError: () => {
      toast.error("Failed to generate style preview");
    },
  });
}

export function useSeedStyles() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.style.seed.mutationOptions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
      toast.success(data.message);
    },
    onError: () => {
      toast.error("Failed to seed predefined styles");
    },
  });
}

export function useStyleFromImage() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.fromImage.mutationOptions(),
    onError: () => {
      toast.error("Failed to extract style from image");
    },
  });
}

export function useRemixStyle() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.remix.mutationOptions(),
    onError: () => {
      toast.error("Failed to generate style remix");
    },
  });
}

export function useBlendStyles() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.blend.mutationOptions(),
    onError: () => {
      toast.error("Failed to blend styles");
    },
  });
}

export function useGenerateAllPreviews() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.generateAllPreviews.mutationOptions(),
    onError: () => {
      toast.error("Failed to start preview generation");
    },
  });
}

export function useMigrateStylesToR2() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.style.migrateToR2.mutationOptions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
      toast.success(data.message);
    },
    onError: () => {
      toast.error("Failed to migrate styles to R2");
    },
  });
}

export function useGeneratePreviewsForStyles() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.generatePreviewsForStyles.mutationOptions(),
    onError: () => {
      toast.error("Failed to start preview generation");
    },
  });
}

export function useGenerateCaptionPreview() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.style.generateCaptionPreview.mutationOptions(),
    onError: () => {
      toast.error("Failed to generate caption samples");
    },
  });
}

export function useSaveStyleWithHistory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.style.saveWithHistory.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
    },
    onError: () => {
      toast.error("Failed to save style");
    },
  });
}

export function useStyleHistory(styleId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.style.getHistory.queryOptions({ styleId: styleId! }),
    enabled: !!styleId,
  });
}

export function useRestoreStyleHistory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.style.restoreHistory.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
      toast.success("Style restored from history");
    },
    onError: () => {
      toast.error("Failed to restore style");
    },
  });
}

