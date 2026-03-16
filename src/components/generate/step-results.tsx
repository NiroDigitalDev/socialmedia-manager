"use client";

import { useGenerateStore, type Platform } from "@/stores/use-generate-store";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2Icon, RotateCcwIcon, InboxIcon } from "lucide-react";

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  x: "X",
  blog: "Blog",
  email: "Email",
};

export function StepResults() {
  const { platforms, generationId, reset, setStep } = useGenerateStore();

  const handleStartOver = () => {
    reset();
    setStep(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Your content</h2>
        <p className="text-sm text-muted-foreground">
          {generationId
            ? "Generation in progress. Results will appear below."
            : "No generation started yet."}
        </p>
      </div>

      {platforms.length > 0 ? (
        <Tabs defaultValue={platforms[0]}>
          <TabsList>
            {platforms.map((platform) => (
              <TabsTrigger key={platform} value={platform}>
                {platformLabels[platform]}
              </TabsTrigger>
            ))}
          </TabsList>

          {platforms.map((platform) => (
            <TabsContent key={platform} value={platform}>
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  {generationId ? (
                    <>
                      <Loader2Icon className="size-8 animate-spin text-muted-foreground/40" />
                      <p className="mt-4 text-sm font-medium text-muted-foreground">
                        Generation in progress...
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        AI is creating your {platformLabels[platform]} content.
                        This may take a moment.
                      </p>
                    </>
                  ) : (
                    <>
                      <InboxIcon className="size-8 text-muted-foreground/40" />
                      <p className="mt-4 text-sm font-medium text-muted-foreground">
                        No results yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        Go back to Settings and hit Generate to create content.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <InboxIcon className="size-8 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              No platforms selected
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Start over to select platforms and generate content.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(5)}>
          Back to Settings
        </Button>
        <Button variant="outline" onClick={handleStartOver} className="gap-1.5">
          <RotateCcwIcon className="size-3.5" />
          Start Over
        </Button>
      </div>
    </div>
  );
}
