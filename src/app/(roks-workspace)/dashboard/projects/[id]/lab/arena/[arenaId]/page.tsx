"use client";

import { use, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useArena, useArenaProgress } from "@/hooks/use-arena";
import { useTRPC } from "@/lib/trpc/client";
import { SetupView } from "@/components/arena/setup-view";
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

  // ── Determine view based on arena state ──
  const allEntries = arena.entries as unknown as Array<{
    id: string;
    status: string;
    rating: string | null;
    roundId: string;
    r2Key: string | null;
  }>;

  const generatingEntries = allEntries.filter((e) => e.status === "generating");
  const completedEntries = allEntries.filter((e) => e.status === "completed");
  const totalEntries = allEntries.length;

  // Get the latest round
  const rounds = (arena.rounds ?? []) as unknown as Array<{ id: string; roundNumber: number }>;
  const latestRound = rounds.length > 0
    ? rounds.reduce((a, b) => (a.roundNumber > b.roundNumber ? a : b))
    : null;

  const latestRoundEntries = latestRound
    ? allEntries.filter((e) => e.roundId === latestRound.id)
    : [];

  const hasUnratedCompleted = latestRoundEntries.some(
    (e) => e.rating === null && e.status === "completed",
  );

  // ── Generating / Progress state ──
  if (generatingEntries.length > 0) {
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
              {completedEntries.length} / {totalEntries} completed
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if all entries just finished generating (none generating, but we have completed unrated)
  const allDoneJustNow = generatingEntries.length === 0 && completedEntries.length > 0 && hasUnratedCompleted;

  // ── All done, ready to swipe ──
  if (allDoneJustNow) {
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
          <div className="text-center">
            <p className="text-sm font-medium">All images generated!</p>
            <p className="text-xs text-muted-foreground mt-1">
              {completedEntries.length} images ready to review
            </p>
          </div>
          <Button
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}/lab/arena/${arenaId}`)
            }
          >
            Start Swiping
          </Button>
          {/* SwipeView placeholder — will be replaced in Task 11 */}
          <div className="hidden" data-placeholder="swipe-view" />
        </div>
      </div>
    );
  }

  // ── SwipeView placeholder (has unrated completed entries in latest round) ──
  if (hasUnratedCompleted) {
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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-muted-foreground">
            SwipeView placeholder — will be implemented in Task 11
          </p>
        </div>
      </div>
    );
  }

  // ── ResultsView placeholder (all entries rated or no unrated completed in latest round) ──
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">
          ResultsView placeholder — will be implemented in Task 12
        </p>
      </div>
    </div>
  );
}
