"use client";

import { useGenerateStore, type Platform } from "@/stores/use-generate-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SparklesIcon, ZapIcon, CrownIcon } from "lucide-react";
import { toast } from "sonner";

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  x: "X",
  blog: "Blog",
  email: "Email",
};

const platformFormats: Record<Platform, { id: string; label: string }[]> = {
  instagram: [
    { id: "static", label: "Static" },
    { id: "carousel", label: "Carousel" },
  ],
  linkedin: [
    { id: "short", label: "Short" },
    { id: "long", label: "Long-form" },
  ],
  reddit: [
    { id: "text", label: "Text" },
    { id: "image", label: "Image" },
  ],
  x: [
    { id: "single", label: "Single" },
    { id: "thread", label: "Thread" },
  ],
  blog: [
    { id: "standard", label: "Standard" },
    { id: "listicle", label: "Listicle" },
  ],
  email: [
    { id: "newsletter", label: "Newsletter" },
    { id: "marketing", label: "Marketing" },
  ],
};

const imagePlatforms: Platform[] = ["instagram", "x", "reddit"];

const aspectRatios = [
  { id: "3:4", label: "3:4" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "9:16", label: "9:16" },
];

const variationOptions = [1, 2, 3, 4, 6];

export function StepSettings() {
  const {
    platforms,
    content,
    settings,
    updateSettings,
    setStep,
    setGenerationId,
  } = useGenerateStore();

  const handleGenerate = () => {
    setGenerationId(`gen-${Date.now()}`);
    setStep(6);
    toast.success("Generation started", {
      description: "Your content is being generated. This may take a moment.",
    });
  };

  const estimatedOutputs = platforms.length * settings.variations;

  const imagePlatformsSelected = platforms.filter((p) =>
    imagePlatforms.includes(p)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Final configuration</h2>
        <p className="text-sm text-muted-foreground">
          Review your selections and configure generation settings.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Platforms:</span>
            <div className="flex gap-1 flex-wrap">
              {platforms.map((p) => (
                <Badge key={p} variant="secondary">
                  {platformLabels[p]}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Content:</span>
            <p className="text-sm mt-0.5 line-clamp-2">{content.prompt}</p>
          </div>
        </CardContent>
      </Card>

      {/* Per-platform format */}
      <Card>
        <CardHeader>
          <CardTitle>Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {platforms.map((platform) => {
            const formats = platformFormats[platform];
            const current =
              settings.formatPerPlatform[platform] ?? formats[0].id;
            return (
              <div key={platform} className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {platformLabels[platform]}
                </Label>
                <ToggleGroup
                  type="single"
                  value={current}
                  onValueChange={(val) => {
                    if (val) {
                      updateSettings({
                        formatPerPlatform: {
                          ...settings.formatPerPlatform,
                          [platform]: val,
                        },
                      });
                    }
                  }}
                  className="justify-start"
                >
                  {formats.map((f) => (
                    <ToggleGroupItem key={f.id} value={f.id} size="sm">
                      {f.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Aspect Ratio (only for image platforms) */}
      {imagePlatformsSelected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aspect Ratio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {imagePlatformsSelected.map((platform) => {
              const current =
                settings.aspectRatioPerPlatform[platform] ?? "1:1";
              return (
                <div key={platform} className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {platformLabels[platform]}
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={current}
                    onValueChange={(val) => {
                      if (val) {
                        updateSettings({
                          aspectRatioPerPlatform: {
                            ...settings.aspectRatioPerPlatform,
                            [platform]: val,
                          },
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
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Model + Variations + Logo */}
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
              Variations per platform
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

          {/* Include Logo */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-logo"
              checked={settings.includeLogo}
              onCheckedChange={(checked) =>
                updateSettings({ includeLogo: checked === true })
              }
            />
            <Label htmlFor="include-logo" className="text-sm">
              Include logo in generated images
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Estimated output */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Estimated outputs:</span>{" "}
          <span className="font-medium">{estimatedOutputs} items</span>
          <span className="text-muted-foreground">
            {" "}
            ({platforms.length} platforms &times; {settings.variations}{" "}
            variations)
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(4)}>
          Back
        </Button>
        <Button
          onClick={handleGenerate}
          size="lg"
          className={cn("gap-2 flex-1 @lg/main:flex-none")}
        >
          <SparklesIcon className="size-4" />
          Generate
        </Button>
      </div>
    </div>
  );
}
