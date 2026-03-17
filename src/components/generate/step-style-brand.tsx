"use client";

import { useGenerateStore } from "@/stores/use-generate-store";
import { useStyles } from "@/hooks/use-styles";
import { useBrandIdentities } from "@/hooks/use-brand-identities";
import { StyleCard } from "@/components/style-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PaletteIcon } from "lucide-react";
import Link from "next/link";

export function StepStyleBrand() {
  const {
    projectId,
    brandIdentityId,
    setBrandIdentityId,
    colorOverride,
    setColorOverride,
    styleIds,
    setStyleIds,
    setStep,
  } = useGenerateStore();

  const { data: brandIdentities, isLoading: brandsLoading } =
    useBrandIdentities(projectId);
  const { data: styles, isLoading: stylesLoading } = useStyles();

  const hasBrands = !!projectId && (brandIdentities?.length ?? 0) > 0;
  const useCustomColors = colorOverride !== null;

  const toggleCustomColors = () => {
    if (useCustomColors) {
      setColorOverride(null);
    } else {
      setColorOverride({ accent: "#6366f1", bg: "#ffffff" });
    }
  };

  const toggleStyle = (id: string) => {
    setStyleIds(
      styleIds.includes(id)
        ? styleIds.filter((s) => s !== id)
        : [...styleIds, id]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">How should it look?</h2>
        <p className="text-sm text-muted-foreground">
          Choose a brand identity and style for your content.
        </p>
      </div>

      {/* Brand Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {projectId ? (
            brandsLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading brand identities...
              </p>
            ) : hasBrands ? (
              <Select
                value={brandIdentityId ?? ""}
                onValueChange={(v) =>
                  setBrandIdentityId(v === "" ? null : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a brand identity" />
                </SelectTrigger>
                <SelectContent>
                  {brandIdentities?.map((bi) => (
                    <SelectItem key={bi.id} value={bi.id}>
                      {bi.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No brand identities found for this project. Create one in
                project settings.
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Brand identities are available when generating within a project.
              Using default styling.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Style Picker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Style</CardTitle>
            <div className="flex items-center gap-2">
              {styleIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {styleIds.length} selected
                </Badge>
              )}
              <Button variant="ghost" size="sm" asChild className="gap-1.5">
                <Link href="/dashboard/styles">
                  Manage styles
                  <span aria-hidden>&rarr;</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stylesLoading ? (
            <div className="grid gap-3 grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : styles && styles.length > 0 ? (
            <div className="grid gap-3 grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
              {styles.map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  selected={styleIds.includes(style.id)}
                  onSelect={() => toggleStyle(style.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8">
              <PaletteIcon className="size-8 text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  No styles available
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Visit the Styles page to create or load visual styles.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link href="/dashboard/styles">
                  <PaletteIcon className="size-3.5" />
                  Go to Styles
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Color Override */}
      <Card>
        <CardHeader>
          <CardTitle>Color Override</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="custom-colors"
              checked={useCustomColors}
              onCheckedChange={toggleCustomColors}
            />
            <Label htmlFor="custom-colors" className="text-sm">
              Use custom colors instead of brand colors
            </Label>
          </div>

          {useCustomColors && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accent-color" className="text-xs">
                  Accent Color
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="accent-color"
                    type="color"
                    value={colorOverride?.accent ?? "#6366f1"}
                    onChange={(e) =>
                      setColorOverride({
                        accent: e.target.value,
                        bg: colorOverride?.bg ?? "#ffffff",
                      })
                    }
                    className="h-8 w-12 cursor-pointer p-0.5"
                  />
                  <Input
                    value={colorOverride?.accent ?? "#6366f1"}
                    onChange={(e) =>
                      setColorOverride({
                        accent: e.target.value,
                        bg: colorOverride?.bg ?? "#ffffff",
                      })
                    }
                    className="font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bg-color" className="text-xs">
                  Background Color
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bg-color"
                    type="color"
                    value={colorOverride?.bg ?? "#ffffff"}
                    onChange={(e) =>
                      setColorOverride({
                        accent: colorOverride?.accent ?? "#6366f1",
                        bg: e.target.value,
                      })
                    }
                    className="h-8 w-12 cursor-pointer p-0.5"
                  />
                  <Input
                    value={colorOverride?.bg ?? "#ffffff"}
                    onChange={(e) =>
                      setColorOverride({
                        accent: colorOverride?.accent ?? "#6366f1",
                        bg: e.target.value,
                      })
                    }
                    className="font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(3)}>
          Back
        </Button>
        <Button onClick={() => setStep(5)}>Continue</Button>
      </div>
    </div>
  );
}
