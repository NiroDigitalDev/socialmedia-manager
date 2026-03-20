"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StyleBreakdownCard } from "@/components/arena/style-breakdown-card";
import { WinnersGallery } from "@/components/arena/winners-gallery";
import {
  useGenerateCaptions,
  useExportWinners,
  useSaveRefinedStyle,
  useCompleteArena,
  useSelectCaption,
} from "@/hooks/use-arena";
import { useStyles } from "@/hooks/use-styles";
import {
  Loader2Icon,
  SparklesIcon,
  DownloadIcon,
  SaveIcon,
  CheckCircle2Icon,
  TrophyIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────

interface ArenaEntry {
  id: string;
  roundId: string;
  imageStyleId: string;
  r2Key: string | null;
  rating: string | null;
  contentScore: number | null;
  styleScore: number | null;
  ratingTags: string[];
  exportedPostId: string | null;
  captions: unknown;
}

interface ArenaRound {
  id: string;
  roundNumber: number;
  learnings: unknown;
}

interface StyleLearnings {
  keepContent: string[];
  keepStyle: string[];
  avoidContent: string[];
  avoidStyle: string[];
  summary: string;
}

interface ResultsViewProps {
  arena: {
    id: string;
    name: string;
    projectId: string;
    rounds: ArenaRound[];
    entries: ArenaEntry[];
  };
  styleNames: Record<string, string>;
  onGenerateNextRound: (
    styles: Array<{ styleId: string; count: number }>,
  ) => void;
  onDone: () => void;
}

// ── Component ────────────────────────────────────────────────────

export function ResultsView({
  arena,
  styleNames,
  onGenerateNextRound,
  onDone,
}: ResultsViewProps) {
  // Determine latest round
  const latestRound = useMemo(() => {
    const sorted = [...arena.rounds].sort(
      (a, b) => b.roundNumber - a.roundNumber,
    );
    return sorted[0] ?? null;
  }, [arena.rounds]);

  const roundNumber = latestRound?.roundNumber ?? 1;

  // Parse learnings for this round
  const roundLearnings = useMemo(() => {
    if (!latestRound?.learnings) return {};
    return latestRound.learnings as Record<string, StyleLearnings>;
  }, [latestRound]);

  // Entries for the latest round, grouped by style
  const latestRoundEntries = useMemo(() => {
    if (!latestRound) return [];
    return arena.entries.filter((e) => e.roundId === latestRound.id);
  }, [arena.entries, latestRound]);

  // Unique style IDs in the latest round
  const styleIds = useMemo(() => {
    const ids = new Set(latestRoundEntries.map((e) => e.imageStyleId));
    return Array.from(ids);
  }, [latestRoundEntries]);

  // Per-style continue/drop state
  const [continuedStyles, setContinuedStyles] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {};
    for (const id of styleIds) {
      initial[id] = true;
    }
    return initial;
  });

  // Per-style count for next round
  const [styleCounts, setStyleCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const id of styleIds) {
      initial[id] = 10;
    }
    return initial;
  });

  // Active tab: breakdown vs gallery
  const [activeTab, setActiveTab] = useState<"breakdown" | "gallery">(
    "breakdown",
  );

  // Mutations
  const generateCaptions = useGenerateCaptions();
  const exportWinners = useExportWinners();
  const saveRefinedStyle = useSaveRefinedStyle();
  const completeArena = useCompleteArena();
  const selectCaption = useSelectCaption();

  // For caption generation: need to pick a caption style
  const { data: allStyles } = useStyles();
  const captionStyles = useMemo(
    () =>
      (allStyles ?? []).filter(
        (s: { kind: string }) => s.kind === "caption" || s.kind === "text",
      ),
    [allStyles],
  );

  // All winners across all rounds (for gallery)
  const allWinners = useMemo(
    () =>
      arena.entries.filter(
        (e) => e.rating === "up" || e.rating === "super",
      ),
    [arena.entries],
  );

  // ── Handlers ───────────────────────────────────────────────────

  const handleToggleContinue = useCallback((styleId: string) => {
    setContinuedStyles((prev) => ({
      ...prev,
      [styleId]: !prev[styleId],
    }));
  }, []);

  const handleCountChange = useCallback((styleId: string, count: number) => {
    setStyleCounts((prev) => ({
      ...prev,
      [styleId]: count,
    }));
  }, []);

  const handleGenerateNextRound = useCallback(() => {
    const styles = Object.entries(continuedStyles)
      .filter(([, cont]) => cont)
      .map(([styleId]) => ({
        styleId,
        count: styleCounts[styleId] ?? 10,
      }));

    if (styles.length === 0) {
      toast.error("Select at least one style to continue");
      return;
    }

    onGenerateNextRound(styles);
  }, [continuedStyles, styleCounts, onGenerateNextRound]);

  const handleGenerateCaptions = useCallback(() => {
    const winnerIds = allWinners.map((e) => e.id);
    if (winnerIds.length === 0) {
      toast.error("No winning entries to generate captions for");
      return;
    }

    // Use first caption/text style, or show error
    const captionStyle = captionStyles[0] as
      | { id: string; name: string }
      | undefined;
    if (!captionStyle) {
      toast.error("No caption style found. Create a text/caption style first.");
      return;
    }

    generateCaptions.mutate(
      {
        entryIds: winnerIds,
        captionStyleId: captionStyle.id,
        countPerImage: 3,
      },
      {
        onSuccess: () => toast.success("Captions generated!"),
      },
    );
  }, [allWinners, captionStyles, generateCaptions]);

  const handleExportSelected = useCallback(
    (entryIds: string[]) => {
      exportWinners.mutate(
        { arenaId: arena.id, entryIds },
        {
          onSuccess: (data) =>
            toast.success(`Exported ${data.exported.length} entries`),
        },
      );
    },
    [arena.id, exportWinners],
  );

  const handleSelectCaption = useCallback(
    (entryId: string, captionIndex: number) => {
      selectCaption.mutate({ entryId, captionIndex });
    },
    [selectCaption],
  );

  const handleSaveStyles = useCallback(() => {
    const toSave = Object.entries(continuedStyles).filter(([, cont]) => cont);
    if (toSave.length === 0) {
      toast.error("No styles selected to save");
      return;
    }

    for (const [styleId] of toSave) {
      saveRefinedStyle.mutate({
        arenaId: arena.id,
        styleId,
      });
    }
  }, [continuedStyles, arena.id, saveRefinedStyle]);

  const handleDone = useCallback(() => {
    completeArena.mutate(
      { arenaId: arena.id },
      {
        onSuccess: () => {
          toast.success("Arena completed");
          onDone();
        },
      },
    );
  }, [arena.id, completeArena, onDone]);

  const isBusy =
    generateCaptions.isPending ||
    exportWinners.isPending ||
    saveRefinedStyle.isPending ||
    completeArena.isPending;

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Round {roundNumber} Results
            </h2>
            <p className="text-sm text-muted-foreground">{arena.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {allWinners.length} winner{allWinners.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline">
              {arena.rounds.length} round
              {arena.rounds.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mt-3 flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("breakdown")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "breakdown"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Style Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gallery")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "gallery"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <TrophyIcon className="mr-1.5 inline-block size-3.5" />
            Winners Gallery
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === "breakdown" ? (
          <div className="space-y-4">
            {/* Per-style breakdown cards */}
            {styleIds.map((styleId) => {
              const styleEntries = latestRoundEntries.filter(
                (e) => e.imageStyleId === styleId,
              );
              return (
                <StyleBreakdownCard
                  key={styleId}
                  styleId={styleId}
                  styleName={styleNames[styleId] ?? "Unknown"}
                  entries={styleEntries}
                  learnings={roundLearnings[styleId] ?? null}
                  continued={continuedStyles[styleId] ?? true}
                  onToggleContinue={() => handleToggleContinue(styleId)}
                  countForNextRound={styleCounts[styleId] ?? 10}
                  onCountChange={(count) => handleCountChange(styleId, count)}
                />
              );
            })}

            {/* Learnings summary (if round > 1) */}
            {roundNumber > 1 &&
              Object.keys(roundLearnings).length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <SparklesIcon className="size-4 text-amber-500" />
                      Round {roundNumber} AI Learnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      {Object.entries(roundLearnings).map(
                        ([styleId, learnings]) => (
                          <div key={styleId}>
                            <span className="font-medium text-foreground">
                              {styleNames[styleId] ?? styleId}:
                            </span>{" "}
                            {learnings.summary || "No summary available."}
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        ) : (
          <WinnersGallery
            entries={allWinners}
            rounds={arena.rounds}
            styleNames={styleNames}
            onExport={handleExportSelected}
            onSelectCaption={handleSelectCaption}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="border-t px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleGenerateNextRound}
            disabled={isBusy}
          >
            {generateCaptions.isPending ? (
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
            ) : (
              <SparklesIcon className="mr-1.5 size-4" />
            )}
            Generate Round {roundNumber + 1}
          </Button>

          <Button
            variant="secondary"
            onClick={handleGenerateCaptions}
            disabled={isBusy || allWinners.length === 0}
          >
            {generateCaptions.isPending ? (
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
            ) : (
              <SparklesIcon className="mr-1.5 size-4" />
            )}
            Generate Captions
          </Button>

          <Button
            variant="secondary"
            onClick={() =>
              handleExportSelected(allWinners.map((e) => e.id))
            }
            disabled={isBusy || allWinners.length === 0}
          >
            {exportWinners.isPending ? (
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
            ) : (
              <DownloadIcon className="mr-1.5 size-4" />
            )}
            Export Selected
          </Button>

          <Button
            variant="secondary"
            onClick={handleSaveStyles}
            disabled={isBusy}
          >
            {saveRefinedStyle.isPending ? (
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
            ) : (
              <SaveIcon className="mr-1.5 size-4" />
            )}
            Save Style
          </Button>

          <Button
            variant="outline"
            onClick={handleDone}
            disabled={isBusy}
          >
            {completeArena.isPending ? (
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
            ) : (
              <CheckCircle2Icon className="mr-1.5 size-4" />
            )}
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
