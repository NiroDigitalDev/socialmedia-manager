"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Trash2Icon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";

export interface ExperimentCardExperiment {
  id: string;
  name: string;
  createdAt: string | Date;
  _count: { runs: number };
}

interface ExperimentCardProps {
  experiment: ExperimentCardExperiment;
  projectId: string;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

function getRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (diffDays > 0) return rtf.format(-diffDays, "day");
  if (diffHours > 0) return rtf.format(-diffHours, "hour");
  if (diffMinutes > 0) return rtf.format(-diffMinutes, "minute");
  return rtf.format(-diffSeconds, "second");
}

export function ExperimentCard({
  experiment,
  projectId,
  onDelete,
  isDeleting,
}: ExperimentCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const createdAt =
    typeof experiment.createdAt === "string"
      ? new Date(experiment.createdAt)
      : experiment.createdAt;

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <Link
        href={`/dashboard/projects/${projectId}/lab/${experiment.id}`}
        className="block"
      >
        <Card
          className={cn(
            "group relative overflow-hidden transition-all",
            "bg-gradient-to-t from-primary/5 to-card dark:bg-card",
            "hover:bg-muted/50 cursor-pointer"
          )}
        >
          <CardHeader className="px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="line-clamp-1 text-sm">
                {experiment.name}
              </CardTitle>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {experiment._count.runs}{" "}
                {experiment._count.runs === 1 ? "run" : "runs"}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Created {getRelativeTime(createdAt)}
            </CardDescription>
          </CardHeader>

          {/* Delete button */}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-2 top-2 size-7",
                "opacity-0 transition-opacity group-hover:opacity-100",
                "bg-background/80 backdrop-blur-sm",
                "hover:bg-destructive/10 hover:text-destructive"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmOpen(true);
              }}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
        </Card>
      </Link>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete experiment?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{experiment.name}&rdquo; and all
            its runs. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onDelete?.(experiment.id);
              setConfirmOpen(false);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
