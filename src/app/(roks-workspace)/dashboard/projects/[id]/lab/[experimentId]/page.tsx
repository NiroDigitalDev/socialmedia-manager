"use client";

import { use, useEffect } from "react";
import { useExperiment, useCreateRun, useDeleteRun } from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { RunSidebar } from "@/components/lab/run-sidebar";
import { ConfigureTab } from "@/components/lab/configure-tab";
import { ResultsTab } from "@/components/lab/results-tab";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeftIcon,
  SettingsIcon,
  LayoutGridIcon,
  DownloadIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ExperimentWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; experimentId: string }>;
}) {
  const { id: projectId, experimentId } = use(params);

  const { data: experiment, isLoading, isError } = useExperiment(experimentId);
  const createRun = useCreateRun();
  const deleteRun = useDeleteRun();

  const {
    selectedRunId,
    selectRun,
    activeTab,
    setActiveTab,
    reset,
  } = useLabStore();

  // Reset store on mount / experiment change
  useEffect(() => {
    reset();
  }, [experimentId, reset]);

  const handleNewRun = () => {
    createRun.mutate(
      {
        experimentId,
        settingsSnapshot: {
          contentPrompt: null,
          contentIdeaId: null,
          contentSourceId: null,
          assetIds: [],
          imageStyleId: null,
          captionStyleId: null,
          model: "nano-banana-2",
          aspectRatio: "3:4",
          colorOverride: null,
          conceptCount: 3,
          imageVariations: 2,
          captionVariations: 2,
        },
      },
      {
        onSuccess: (data) => {
          selectRun(data.id);
          setActiveTab("configure");
          toast.success("Run created");
        },
      }
    );
  };

  const handleDeleteRun = (runId: string) => {
    deleteRun.mutate(
      { runId },
      {
        onSuccess: () => {
          if (selectedRunId === runId) {
            selectRun(null);
          }
          toast.success("Run deleted");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="flex w-[280px] shrink-0 flex-col border-r p-3 gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !experiment) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">
          Failed to load experiment. Please try again.
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

  const runs = experiment.runs ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href={`/dashboard/projects/${projectId}/lab`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <h1 className="text-sm font-semibold truncate">
          {experiment.name}
        </h1>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Run sidebar */}
        <RunSidebar
          experimentId={experimentId}
          runs={runs}
          isLoading={false}
          onNewRun={handleNewRun}
          isCreatingRun={createRun.isPending}
          onDeleteRun={handleDeleteRun}
          isDeletingRun={deleteRun.isPending}
        />

        {/* Main workspace */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedRunId ? (
            <Tabs
              value={activeTab}
              onValueChange={(val) =>
                setActiveTab(val as "configure" | "results" | "export")
              }
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="border-b px-4">
                <TabsList className="h-9 bg-transparent p-0">
                  <TabsTrigger
                    value="configure"
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <SettingsIcon className="size-3.5" />
                    Configure
                  </TabsTrigger>
                  <TabsTrigger
                    value="results"
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <LayoutGridIcon className="size-3.5" />
                    Results
                  </TabsTrigger>
                  <TabsTrigger
                    value="export"
                    className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <DownloadIcon className="size-3.5" />
                    Export
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="configure"
                className="flex-1 overflow-y-auto mt-0"
              >
                <ConfigureTab
                  runId={selectedRunId}
                  experimentId={experimentId}
                />
              </TabsContent>

              <TabsContent
                value="results"
                className="flex-1 overflow-y-auto mt-0"
              >
                <ResultsTab runId={selectedRunId} />
              </TabsContent>

              <TabsContent
                value="export"
                className="flex-1 overflow-y-auto mt-0"
              >
                <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
                  Export tab coming soon
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a run or create a new one
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
