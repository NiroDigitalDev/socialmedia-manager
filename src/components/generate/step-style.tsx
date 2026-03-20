"use client";

import { useGenerateStore } from "@/stores/use-generate-store";
import { useStyles } from "@/hooks/use-styles";
import { StyleCard } from "@/components/style-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaletteIcon } from "lucide-react";
import Link from "next/link";

export function StepStyle() {
  const {
    imageStyleId,
    setImageStyleId,
    captionStyleId,
    setCaptionStyleId,
    setStep,
  } = useGenerateStore();

  const { data: styles, isLoading } = useStyles();

  const imageStyles = styles?.filter((s) => (s.kind ?? "image") === "image") ?? [];
  const captionStyles = styles?.filter((s) => s.kind === "caption") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">How should it look?</h2>
        <p className="text-sm text-muted-foreground">
          Pick an image style and optionally a caption style.
        </p>
      </div>

      {/* Image Style */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Image Style
            {imageStyleId && (
              <Badge variant="secondary" className="ml-2 text-xs">1 selected</Badge>
            )}
          </h3>
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href="/dashboard/styles">
              Manage styles <span aria-hidden>&rarr;</span>
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : imageStyles.length > 0 ? (
          <div className="grid gap-3 grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4">
            {imageStyles.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={imageStyleId === style.id}
                onSelect={() =>
                  setImageStyleId(imageStyleId === style.id ? null : style.id)
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8">
            <PaletteIcon className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No image styles available</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/styles">Go to Styles</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Caption Style */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">
          Caption Style <span className="text-muted-foreground">(optional)</span>
          {captionStyleId && (
            <Badge variant="secondary" className="ml-2 text-xs">1 selected</Badge>
          )}
        </h3>

        {isLoading ? (
          <div className="grid gap-3 grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : captionStyles.length > 0 ? (
          <div className="grid gap-3 grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4">
            {captionStyles.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={captionStyleId === style.id}
                onSelect={() =>
                  setCaptionStyleId(captionStyleId === style.id ? null : style.id)
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No caption styles available. You can create them in the Styles page.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
        <Button onClick={() => setStep(3)}>Continue</Button>
      </div>
    </div>
  );
}
