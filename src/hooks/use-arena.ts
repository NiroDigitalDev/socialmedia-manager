"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

// ── Queries ────────────────────────────────────────────────────────

export function useArenas(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.arena.listArenas.queryOptions({ projectId }));
}

export function useArena(arenaId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.arena.getArena.queryOptions({ arenaId: arenaId! }),
    enabled: !!arenaId,
  });
}

export function useArenaProgress(arenaId: string | undefined, enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.arena.arenaProgress.queryOptions({ arenaId: arenaId! }),
    enabled: !!arenaId && enabled,
    refetchInterval: enabled ? 2000 : false,
  });
}

export function useSwipeQueue(roundId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.arena.getSwipeQueue.queryOptions({ roundId: roundId! }),
    enabled: !!roundId,
  });
}

export function useRoundResults(roundId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.arena.getRoundResults.queryOptions({ roundId: roundId! }),
    enabled: !!roundId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────

export function useCreateArena() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.createArena.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.listArenas.queryKey({ projectId: vars.projectId }),
      });
    },
    onError: () => {
      toast.error("Failed to create arena");
    },
  });
}

export function useRateEntry() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.rateEntry.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getSwipeQueue.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getRoundResults.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to rate entry");
    },
  });
}

export function useGenerateNextRound() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.generateNextRound.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate next round");
    },
  });
}

export function useGenerateCaptions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.generateCaptions.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate captions");
    },
  });
}

export function useSelectCaption() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.selectCaption.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to select caption");
    },
  });
}

export function useExportWinners() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.exportWinners.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to export winners");
    },
  });
}

export function useSaveRefinedStyle() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.saveRefinedStyle.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      toast.success("Refined style saved");
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to save refined style");
    },
  });
}

export function useCompleteArena() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.completeArena.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.listArenas.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to complete arena");
    },
  });
}

export function useDeleteArena() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.arena.deleteArena.mutationOptions();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.arena.listArenas.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to delete arena");
    },
  });
}
