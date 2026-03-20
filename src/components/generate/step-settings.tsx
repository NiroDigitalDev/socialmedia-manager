"use client";

import { useGenerateStore } from "@/stores/use-generate-store";
import { useGenerate } from "@/hooks/use-generations";
import { useStyles } from "@/hooks/use-styles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  SparklesIcon,
  ZapIcon,
  CrownIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

const aspectRatios = [
  { id: "3:4", label: "3:4" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "9:16", label: "9:16" },
];

const variationOptions = [1, 2, 3, 4, 6];

// Map UI model names to server model keys
const modelKeyMap: Record<string, string> = {
  flash: "nano-banana-2",
  pro: "nano-banana-pro",
};

export function StepSettings() {
  const {
    content,
    outline,
    imageStyleId,
    captionStyleId,
    settings,
    updateSettings,
    projectId,
    campaignId,
    setStep,
    setGenerationId,
  } = useGenerateStore();

  const generate = useGenerate();
  const { data: styles } = useStyles();

  // Look up selected style names for summary
  const imageStyleName = styles?.find((s) => s.id === imageStyleId)?.name;
  const captionStyleName = styles?.find((s) => s.id === captionStyleId)?.name;

  const handleGenerate = () => {
    const format = content.format ?? "static";
    const slideCount = outline?.slides.length ?? content.slideCount ?? 1;

    // Build slide prompts from outline
    const slidePrompts = outline?.slides.map((s) => s.imagePrompt) ?? [];

    // Build style IDs array
    const styleIds: string[] = [];
    if (imageStyleId) styleIds.push(imageStyleId);

    generate.mutate(
      {
        prompt: content.prompt,
        platforms: ["instagram"],
        styleIds,
        colorOverride: settings.colorOverride ?? undefined,
        formatPerPlatform: { instagram: format } as any,
        aspectRatioPerPlatform: { instagram: settings.aspectRatio } as any,
        model: (modelKeyMap[settings.model] ?? "nano-banana-2") as
          | "nano-banana-2"
          | "nano-banana-pro",
        variations: settings.variations,
        includeLogo: false,
        outline: outline ?? undefined,
        slideCount,
        slidePrompts: slidePrompts.length > 0 ? slidePrompts : undefined,
        styleGuide: content.styleGuide ?? undefined,
        contentIdeaId: content.contentIdeaId ?? undefined,
        projectId: projectId ?? undefined,
        campaignId: campaignId ?? undefined,
      },
      {
        onSuccess: (data) => {
          setGenerationId(data.postIds.join(","));
          setStep(5);
          toast.success("Generation started", {
            description:
              "Your content is being generated. Results will appear shortly.",
          });
        },
        onError: (err) => {
          toast.error(err.message ?? "Generation failed. Please try again.");
        },
      }
    );
  };

  const estimatedOutputs = settings.variations;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Final configuration</h2>
        <p className="text-sm text-muted-foreground">
          Review your selections and configure generation settings.
        </p>
      </div>

      {/* Generation Summary */}
      <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Platform:</span>
            <Badge variant="secondary">Instagram</Badge>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Content:</span>
            <p className="text-sm mt-0.5 line-clamp-2">{content.prompt}</p>
          </div>
          {imageStyleName && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Image Style:</span>
              <Badge variant="secondary">{imageStyleName}</Badge>
            </div>
          )}
          {captionStyleName && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Caption Style:</span>
              <Badge variant="secondary">{captionStyleName}</Badge>
            </div>
          )}
          {outline && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Outline:</span>
              <Badge variant="secondary">
                {outline.slides.length} slide{outline.slides.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
          {content.format && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Format:</span>
              <Badge variant="outline">{content.format}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aspect Ratio */}
      <Card>
        <CardHeader>
          <CardTitle>Aspect Ratio</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={settings.aspectRatio}
            onValueChange={(val) => {
              if (val) {
                updateSettings({
                  aspectRatio: val as "3:4" | "1:1" | "4:5" | "9:16",
                });
              }
            }}
            className="justify-start"
          >
            {aspectRatios.map((ar) => (
              <ToggleGroupItem key={ar.id} value={ar.id} size="sm">
                {ar.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>

      {/* Custom Color Override */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Colors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Optionally override the accent and background colors for this generation.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="accent-color" className="text-xs text-muted-foreground">
                Accent
              </Label>
              <Input
                id="accent-color"
                type="color"
                value={settings.colorOverride?.accent ?? "#6366f1"}
                onChange={(e) =>
                  updateSettings({
                    colorOverride: {
                      accent: e.target.value,
                      bg: settings.colorOverride?.bg ?? "#ffffff",
                    },
                  })
                }
                className="h-8 w-12 cursor-pointer p-0.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bg-color" className="text-xs text-muted-foreground">
                Background
              </Label>
              <Input
                id="bg-color"
                type="color"
                value={settings.colorOverride?.bg ?? "#ffffff"}
                onChange={(e) =>
                  updateSettings({
                    colorOverride: {
                      accent: settings.colorOverride?.accent ?? "#6366f1",
                      bg: e.target.value,
                    },
                  })
                }
                className="h-8 w-12 cursor-pointer p-0.5"
              />
            </div>
            {settings.colorOverride && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => updateSettings({ colorOverride: null })}
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model + Variations */}
      <Card>
        <CardHeader>
          <CardTitle>Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">AI Model</Label>
            <ToggleGroup
              type="single"
              value={settings.model}
              onValueChange={(val) => {
                if (val === "flash" || val === "pro") {
                  updateSettings({ model: val });
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="flash" className="gap-1.5">
                <ZapIcon className="size-3.5" />
                Flash
              </ToggleGroupItem>
              <ToggleGroupItem value="pro" className="gap-1.5">
                <CrownIcon className="size-3.5" />
                Pro
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Variations */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Variations
            </Label>
            <ToggleGroup
              type="single"
              value={String(settings.variations)}
              onValueChange={(val) => {
                if (val) updateSettings({ variations: parseInt(val) });
              }}
              className="justify-start"
            >
              {variationOptions.map((n) => (
                <ToggleGroupItem key={n} value={String(n)} size="sm">
                  {n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* Estimated output */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Estimated outputs:</span>{" "}
          <span className="font-medium">{estimatedOutputs} item{estimatedOutputs !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">
            {" "}
            ({settings.variations} variation{settings.variations !== 1 ? "s" : ""})
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(3)}>
          Back
        </Button>
        <Button
          onClick={handleGenerate}
          size="lg"
          disabled={generate.isPending}
          className={cn("gap-2 flex-1 @lg/main:flex-none")}
        >
          {generate.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          {generate.isPending ? "Generating..." : "Generate"}
        </Button>
      </div>
    </div>
  );
}
