"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
  GitCompareArrowsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLabStore } from "@/stores/use-lab-store";

export interface RunSummary {
  id: string;
  runNumber: number;
  status: string;
  scope: string;
  parentRunId: string | null;
  createdAt: string | Date;
}

interface RunSidebarProps {
  experimentId: string;
  runs: RunSummary[];
  isLoading?: boolean;
  onNewRun: () => void;
  isCreatingRun?: boolean;
  onDeleteRun: (runId: string) => void;
  isDeletingRun?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  generating: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  configuring: "bg-muted text-muted-foreground",
  cancelled: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

export function RunSidebar({
  runs,
  isLoading,
  onNewRun,
  isCreatingRun,
  onDeleteRun,
  isDeletingRun,
}: RunSidebarProps) {
  const {
    selectedRunId,
    selectRun,
    comparisonMode,
    comparisonRunIds,
    setComparisonRuns,
    toggleComparisonMode,
  } = useLabStore();

  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);

  // In comparison mode, track up to 2 checked runs
  const handleComparisonToggle = (runId: string, checked: boolean) => {
    const current: string[] = comparisonRunIds ? [...comparisonRunIds] : [];
    if (checked) {
      if (current.length < 2) {
        const next = [...current, runId];
        if (next.length === 2) {
          setComparisonRuns(next as [string, string]);
        } else {
          setComparisonRuns(null);
          selectRun(runId);
        }
      }
    } else {
      const next = current.filter((id) => id !== runId);
      setComparisonRuns(null);
      if (next.length === 1) {
        selectRun(next[0]);
      }
    }
  };

  const isRunChecked = (runId: string) => {
    if (!comparisonRunIds) return selectedRunId === runId;
    return comparisonRunIds.includes(runId);
  };

  // Build a lookup for parent run numbers
  const runNumberById = new Map(runs.map((r) => [r.id, r.runNumber]));

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium">Runs</h2>
        <div className="flex items-center gap-1">
          {runs.length >= 2 && (
            <Button
              size="sm"
              variant={comparisonMode ? "secondary" : "ghost"}
              onClick={toggleComparisonMode}
              className="h-7 gap-1 px-2 text-xs"
              title="Compare two runs"
            >
              <GitCompareArrowsIcon className="size-3" />
              {comparisonMode ? "Exit" : "Compare"}
            </Button>
          )}
          {!comparisonMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={onNewRun}
              disabled={isCreatingRun}
              className="h-7 gap-1 px-2 text-xs"
            >
              {isCreatingRun ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <PlusIcon className="size-3" />
              )}
              New Run
            </Button>
          )}
        </div>
      </div>

      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && runs.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-xs text-muted-foreground">
              No runs yet.
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Create a run to start generating variations.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onNewRun}
              disabled={isCreatingRun}
              className="h-7 gap-1 px-3 text-xs"
            >
              {isCreatingRun ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <PlusIcon className="size-3" />
              )}
              New Run
            </Button>
          </div>
        )}

        {!isLoading && runs.length > 0 && (
          <div className="space-y-1 p-2">
            {runs.map((run) => {
              const isSelected =
                !comparisonMode && selectedRunId === run.id;

              return (
                <div
                  key={run.id}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50 cursor-pointer"
                  )}
                  onClick={() => {
                    if (!comparisonMode) {
                      selectRun(run.id);
                    }
                  }}
                >
                  {/* Comparison checkbox */}
                  {comparisonMode && (
                    <Checkbox
                      checked={isRunChecked(run.id)}
                      onCheckedChange={(checked) =>
                        handleComparisonToggle(run.id, !!checked)
                      }
                      className="shrink-0"
                    />
                  )}

                  {/* Run info */}
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        Run #{run.runNumber}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-4 px-1.5 text-[10px] leading-none",
                          STATUS_COLORS[run.status] ?? STATUS_COLORS.configuring
                        )}
                      >
                        {run.status}
                      </Badge>
                      {run.scope !== "full" && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[10px] leading-none text-muted-foreground"
                        >
                          {run.scope}
                        </Badge>
                      )}
                    </div>
                    {run.parentRunId && runNumberById.has(run.parentRunId) && (
                      <span className="text-[10px] text-muted-foreground">
                        from Run #{runNumberById.get(run.parentRunId)}
                      </span>
                    )}
                  </div>

                  {/* Delete button (hover) */}
                  {!comparisonMode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "absolute right-1 top-1/2 -translate-y-1/2 size-6",
                        "opacity-0 transition-opacity group-hover:opacity-100",
                        "hover:bg-destructive/10 hover:text-destructive"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteRunId(run.id);
                      }}
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteRunId}
        onOpenChange={(open) => {
          if (!open) setDeleteRunId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this run and all its generated
              content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteRunId) {
                  onDeleteRun(deleteRunId);
                  if (selectedRunId === deleteRunId) {
                    selectRun(null);
                  }
                  setDeleteRunId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingRun ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
