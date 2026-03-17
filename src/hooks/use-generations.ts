"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useGenerateOutline() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.generation.generateOutline.mutationOptions(),
    onError: () => {
      toast.error("Failed to generate outline");
    },
  });
}

export function useGenerate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.recent.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.generation.list.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate content");
    },
  });
}

export function useGenerationResults(postIds: string[] | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generation.getResults.queryOptions({ postIds: postIds ?? [] }),
    enabled: !!postIds && postIds.length > 0,
    // Poll every 2s while any post is still generating
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasGenerating = data.some(
        (post: any) => post.status === "generating"
      );
      return hasGenerating ? 2000 : false;
    },
  });
}

export function useGenerationList(filters?: {
  projectId?: string;
  campaignId?: string;
  platform?: "instagram" | "linkedin" | "reddit" | "x" | "blog" | "email";
  limit?: number;
  offset?: number;
}) {
  const trpc = useTRPC();
  return useQuery(
    trpc.generation.list.queryOptions({
      projectId: filters?.projectId,
      campaignId: filters?.campaignId,
      platform: filters?.platform,
      limit: filters?.limit ?? 20,
      offset: filters?.offset ?? 0,
    })
  );
}

export function useCampaignGenerations(campaignId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generation.byCampaign.queryOptions({ campaignId: campaignId! }),
    enabled: !!campaignId,
  });
}

export function useRecentGenerations() {
  const trpc = useTRPC();
  return useQuery(trpc.generation.recent.queryOptions());
}

export function useGenerateDescription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generateDescription.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.getResults.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate description");
    },
  });
}

export function useUpdateDescription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.updateDescription.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.getResults.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.generation.list.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to update description");
    },
  });
}

export function useDeletePost() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.deletePost.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.list.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.generation.recent.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to delete post");
    },
  });
}
