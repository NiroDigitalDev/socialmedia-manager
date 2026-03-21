"use client";

import { use, useMemo, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useArena,
  useArenaProgress,
  useGenerateNextRound,
} from "@/hooks/use-arena";
import { useStyles } from "@/hooks/use-styles";
import { useTRPC } from "@/lib/trpc/client";
import { SetupView } from "@/components/arena/setup-view";
import { SwipeView } from "@/components/arena/swipe-view";
import { ResultsView } from "@/components/arena/results-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ArenaPage({
  params,
}: {
  params: Promise<{ id: string; arenaId: string }>;
}) {
  const { id: projectId, arenaId } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // "new" arena — render setup view
  const isNew = arenaId === "new";

  const { data: arena, isLoading, isError } = useArena(isNew ? undefined : arenaId);

  // Fetch styles to build styleNames map
  const { data: allStyles } = useStyles();
  const styleNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (allStyles) {
      for (const style of allStyles as Array<{ id: string; name: string }>) {
        map[style.id] = style.name;
      }
    }
    return map;
  }, [allStyles]);

  // Determine generating state
  const hasGenerating = useMemo(
    () => arena?.entries?.some((e: { status: string }) => e.status === "generating") ?? false,
    [arena?.entries],
  );

  // Poll progress while entries are generating
  const { data: progressEntries } = useArenaProgress(
    isNew ? undefined : arenaId,
    hasGenerating,
  );

  // Refresh full arena data when progress changes
  const prevProgressRef = useRef<string>("");
  useEffect(() => {
    if (!progressEntries || progressEntries.length === 0) return;
    const entries = progressEntries as unknown as Array<{
      id: string;
      status: string;
      r2Key: string | null;
    }>;
    const fingerprint = entries
      .map((e) => `${e.id}:${e.status}:${e.r2Key ?? ""}`)
      .sort()
      .join("|");
    if (fingerprint !== prevProgressRef.current) {
      prevProgressRef.current = fingerprint;
      queryClient.invalidateQueries({
        queryKey: trpc.arena.getArena.queryKey({ arenaId }),
      });
    }
  }, [progressEntries, queryClient, trpc, arenaId]);

  // Generate next round mutation
  const generateNextRound = useGenerateNextRound();

  // ── Derived arena state ──
  const allEntries = useMemo(
    () =>
      (arena?.entries ?? []) as unknown as Array<{
        id: string;
        status: string;
        rating: string | null;
        roundId: string;
        r2Key: string | null;
        imageStyleId: string;
        contentScore: number | null;
        styleScore: number | null;
        ratingTags: string[];
        exportedPostId: string | null;
        captions: unknown;
      }>,
    [arena?.entries],
  );

  const rounds = useMemo(
    () =>
      (arena?.rounds ?? []) as unknown as Array<{
        id: string;
        roundNumber: number;
        learnings: unknown;
      }>,
    [arena?.rounds],
  );

  const latestRound = useMemo(
    () =>
      rounds.length > 0
        ? rounds.reduce((a, b) => (a.roundNumber > b.roundNumber ? a : b))
        : null,
    [rounds],
  );

  const generatingEntries = useMemo(
    () => allEntries.filter((e) => e.status === "generating"),
    [allEntries],
  );

  const completedEntries = useMemo(
    () => allEntries.filter((e) => e.status === "completed"),
    [allEntries],
  );

  const hasUnratedCompleted = useMemo(
    () =>
      latestRound
        ? allEntries.some(
            (e) =>
              e.roundId === latestRound.id &&
              e.status === "completed" &&
              e.rating === null,
          )
        : false,
    [allEntries, latestRound],
  );

  // ── Handlers ──

  const handleSwipeComplete = useCallback(() => {
    // Invalidate arena data so we re-derive the view (should switch to ResultsView)
    queryClient.invalidateQueries({
      queryKey: trpc.arena.getArena.queryKey({ arenaId }),
    });
  }, [queryClient, trpc, arenaId]);

  const handleGenerateNextRound = useCallback(
    (styles: Array<{ styleId: string; count: number }>) => {
      if (!latestRound) return;
      generateNextRound.mutate({
        arenaId,
        previousRoundId: latestRound.id,
        styles,
      });
      // After mutation succeeds, the arena data will refresh and show generating state
    },
    [arenaId, latestRound, generateNextRound],
  );

  const handleDone = useCallback(() => {
    router.push(`/dashboard/projects/${projectId}/lab`);
  }, [router, projectId]);

  // ── New arena ──
  if (isNew) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href={`/dashboard/projects/${projectId}/lab`}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold">New Arena</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SetupView projectId={projectId} />
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Skeleton className="size-7" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (isError || !arena) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8">
        <p className="text-sm text-muted-foreground">
          Failed to load arena. Please try again.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/projects/${projectId}/lab`}>
            <ArrowLeftIcon className="mr-1.5 size-3.5" />
            Back to Lab
          </Link>
        </Button>
      </div>
    );
  }

  // ── Generating with no completed entries yet — show progress spinner ──
  if (generatingEntries.length > 0 && !hasUnratedCompleted) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href={`/dashboard/projects/${projectId}/lab`}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold truncate">{arena.name}</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Generating images...</p>
            <p className="text-xs text-muted-foreground mt-1">
              {completedEntries.length} / {allEntries.length} completed
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── SwipeView — has unrated completed entries (may still be generating others) ──
  if (hasUnratedCompleted && latestRound) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Button variant="ghost" size="icon" className="size-7" asChild>
            <Link href={`/dashboard/projects/${projectId}/lab`}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold truncate">{arena.name}</h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <SwipeView
            roundId={latestRound.id}
            roundNumber={latestRound.roundNumber}
            arenaId={arenaId}
            onComplete={handleSwipeComplete}
            styleNames={styleNames}
          />
        </div>
      </div>
    );
  }

  // ── ResultsView — all entries rated (or no unrated completed in latest round) ──
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href={`/dashboard/projects/${projectId}/lab`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <h1 className="text-sm font-semibold truncate">{arena.name}</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <ResultsView
          arena={{
            id: arena.id as string,
            name: arena.name as string,
            projectId: projectId,
            rounds,
            entries: allEntries,
          }}
          styleNames={styleNames}
          onGenerateNextRound={handleGenerateNextRound}
          isGeneratingNextRound={generateNextRound.isPending}
          onDone={handleDone}
        />
      </div>
    </div>
  );
}
