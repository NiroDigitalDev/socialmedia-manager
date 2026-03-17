"use client";

import { useGenerateStore, type Platform } from "@/stores/use-generate-store";
import { useBrandIdentity } from "@/hooks/use-brand-identities";
import { useStyles } from "@/hooks/use-styles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  InstagramIcon,
  LinkedinIcon,
  MessageSquareIcon,
  TwitterIcon,
  BookOpenIcon,
  MailIcon,
  ZapIcon,
  CrownIcon,
  HashIcon,
  ImageIcon,
  AtSignIcon,
  TypeIcon,
} from "lucide-react";

// ---------- Platform config ----------

const platformMeta: Record<
  Platform,
  { name: string; icon: React.ElementType; color: string }
> = {
  instagram: { name: "Instagram", icon: InstagramIcon, color: "#E4405F" },
  linkedin: { name: "LinkedIn", icon: LinkedinIcon, color: "#0A66C2" },
  reddit: { name: "Reddit", icon: MessageSquareIcon, color: "#FF4500" },
  x: { name: "X", icon: TwitterIcon, color: "#1DA1F2" },
  blog: { name: "Blog", icon: BookOpenIcon, color: "#6366f1" },
  email: { name: "Email", icon: MailIcon, color: "#10B981" },
};

// ---------- Platform preview cards ----------

function InstagramPreview({
  prompt,
  aspectRatio,
  accentColor,
}: {
  prompt: string;
  aspectRatio: string;
  accentColor: string | null;
}) {
  const ratioMap: Record<string, string> = {
    "3:4": "aspect-[3/4]",
    "1:1": "aspect-square",
    "4:5": "aspect-[4/5]",
    "9:16": "aspect-[9/16]",
  };
  const ratioClass = ratioMap[aspectRatio] ?? "aspect-square";

  return (
    <div className="space-y-2">
      {/* Image frame mockup */}
      <div
        className={cn("w-full rounded-lg bg-muted/50 flex items-center justify-center", ratioClass)}
        style={{ maxHeight: 120, borderLeft: accentColor ? `3px solid ${accentColor}` : undefined }}
      >
        <ImageIcon className="size-6 text-muted-foreground/30" />
      </div>
      {/* Caption excerpt */}
      {prompt && (
        <p className="line-clamp-2 text-[10px] text-muted-foreground">
          {prompt.slice(0, 120)}...
        </p>
      )}
      {/* Hashtag hint */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
        <HashIcon className="size-2.5" />
        <span>hashtags will be generated</span>
      </div>
    </div>
  );
}

function LinkedInPreview({
  prompt,
  accentColor,
}: {
  prompt: string;
  accentColor: string | null;
}) {
  return (
    <div className="space-y-2">
      <div
        className="rounded-lg border bg-muted/30 p-2"
        style={{ borderLeftColor: accentColor ?? undefined, borderLeftWidth: accentColor ? 3 : undefined }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="size-4 rounded-full bg-muted" />
          <div className="space-y-0.5">
            <div className="h-1.5 w-12 rounded bg-muted" />
            <div className="h-1 w-8 rounded bg-muted/60" />
          </div>
        </div>
        {prompt && (
          <p className="line-clamp-3 text-[10px] text-muted-foreground">
            {prompt.slice(0, 150)}
          </p>
        )}
      </div>
    </div>
  );
}

function XPreview({ prompt }: { prompt: string }) {
  const charCount = prompt.length;
  const isThread = charCount > 280;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-muted/30 p-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="size-4 rounded-full bg-muted" />
          <div className="h-1.5 w-16 rounded bg-muted" />
        </div>
        {prompt && (
          <p className="line-clamp-2 text-[10px] text-muted-foreground">
            {prompt.slice(0, 280)}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className={cn("text-muted-foreground", charCount > 280 && "text-amber-500")}>
          {Math.min(charCount, 280)}/280
        </span>
        {isThread && (
          <Badge variant="outline" className="text-[9px] h-4 px-1">
            Thread
          </Badge>
        )}
      </div>
    </div>
  );
}

function BlogPreview({
  prompt,
  outline,
  accentColor,
}: {
  prompt: string;
  outline: { label: string; content: string }[];
  accentColor: string | null;
}) {
  return (
    <div className="space-y-2">
      <div
        className="rounded-lg border bg-muted/30 p-2"
        style={{ borderTopColor: accentColor ?? undefined, borderTopWidth: accentColor ? 2 : undefined }}
      >
        <div className="h-2 w-3/4 rounded bg-muted mb-1.5" />
        <div className="h-1.5 w-1/2 rounded bg-muted/60 mb-2" />
        {outline.length > 0 ? (
          <div className="space-y-1">
            {outline.slice(0, 3).map((section, i) => (
              <div key={i} className="flex items-center gap-1">
                <TypeIcon className="size-2 text-muted-foreground/40" />
                <span className="text-[9px] text-muted-foreground truncate">
                  {section.label}
                </span>
              </div>
            ))}
          </div>
        ) : prompt ? (
          <p className="line-clamp-2 text-[10px] text-muted-foreground">
            {prompt.slice(0, 100)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmailPreview({
  prompt,
  outline,
  accentColor,
}: {
  prompt: string;
  outline: { label: string; content: string }[];
  accentColor: string | null;
}) {
  return (
    <div className="space-y-2">
      <div
        className="rounded-lg border bg-muted/30 p-2"
        style={{ borderTopColor: accentColor ?? undefined, borderTopWidth: accentColor ? 2 : undefined }}
      >
        <div className="flex items-center gap-1 mb-1.5">
          <AtSignIcon className="size-2.5 text-muted-foreground/40" />
          <div className="h-1.5 w-20 rounded bg-muted" />
        </div>
        <div className="h-1 w-2/3 rounded bg-muted/60 mb-2" />
        {outline.length > 0 ? (
          <div className="space-y-1">
            {outline.slice(0, 3).map((section, i) => (
              <div key={i}>
                <span className="text-[9px] text-muted-foreground truncate">
                  {section.label}
                </span>
              </div>
            ))}
          </div>
        ) : prompt ? (
          <p className="line-clamp-2 text-[10px] text-muted-foreground">
            {prompt.slice(0, 100)}
          </p>
        ) : null}
        <div
          className="mt-2 h-4 w-16 rounded text-center text-[8px] leading-4 text-white"
          style={{ backgroundColor: accentColor ?? "#6366f1" }}
        >
          CTA Button
        </div>
      </div>
    </div>
  );
}

function RedditPreview({ prompt }: { prompt: string }) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-muted/30 p-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="h-1.5 w-4 rounded bg-muted" />
          <div className="h-1.5 w-20 rounded bg-muted" />
        </div>
        {prompt && (
          <p className="line-clamp-3 text-[10px] text-muted-foreground">
            {prompt.slice(0, 200)}
          </p>
        )}
        <div className="mt-1.5 flex gap-2">
          <div className="h-1 w-6 rounded bg-muted/60" />
          <div className="h-1 w-8 rounded bg-muted/60" />
        </div>
      </div>
    </div>
  );
}

// ---------- Platform card wrapper ----------

function PlatformPreviewCard({
  platform,
  prompt,
  outline,
  aspectRatio,
  accentColor,
}: {
  platform: Platform;
  prompt: string;
  outline: { label: string; content: string }[];
  aspectRatio: string;
  accentColor: string | null;
}) {
  const meta = platformMeta[platform];
  const Icon = meta.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3" style={{ color: meta.color }} />
        <span className="text-xs font-medium">{meta.name}</span>
      </div>
      {platform === "instagram" && (
        <InstagramPreview prompt={prompt} aspectRatio={aspectRatio} accentColor={accentColor} />
      )}
      {platform === "linkedin" && (
        <LinkedInPreview prompt={prompt} accentColor={accentColor} />
      )}
      {platform === "x" && <XPreview prompt={prompt} />}
      {platform === "blog" && (
        <BlogPreview prompt={prompt} outline={outline} accentColor={accentColor} />
      )}
      {platform === "email" && (
        <EmailPreview prompt={prompt} outline={outline} accentColor={accentColor} />
      )}
      {platform === "reddit" && <RedditPreview prompt={prompt} />}
    </div>
  );
}

// ---------- Main preview panel ----------

export function PreviewPanel() {
  // Subscribe to specific store slices for targeted re-renders
  const step = useGenerateStore((s) => s.step);
  const platforms = useGenerateStore((s) => s.platforms);
  const content = useGenerateStore((s) => s.content);
  const outline = useGenerateStore((s) => s.outline);
  const styleIds = useGenerateStore((s) => s.styleIds);
  const brandIdentityId = useGenerateStore((s) => s.brandIdentityId);
  const colorOverride = useGenerateStore((s) => s.colorOverride);
  const settings = useGenerateStore((s) => s.settings);

  // Fetch brand identity data if one is selected
  const { data: brandIdentity } = useBrandIdentity(brandIdentityId ?? "");
  const { data: styles } = useStyles();
  const hasBrand = !!brandIdentityId && !!brandIdentity;

  // Determine accent color: colorOverride > brand palette > null
  const accentColor = colorOverride?.accent
    ?? (hasBrand ? brandIdentity.palettes?.[0]?.accentColor : null)
    ?? null;
  const bgColor = colorOverride?.bg
    ?? (hasBrand ? brandIdentity.palettes?.[0]?.bgColor : null)
    ?? null;

  // Get outline sections per platform
  const outlineByPlatform = (outline ?? []).reduce(
    (acc, section) => {
      if (!acc[section.platform]) acc[section.platform] = [];
      acc[section.platform].push({ label: section.label, content: section.content });
      return acc;
    },
    {} as Record<Platform, { label: string; content: string }[]>
  );

  const estimatedOutputs = platforms.length * settings.variations;

  const stepLabels = ["Platforms", "Content", "Outline", "Style & Brand", "Settings", "Results"];

  return (
    <Card className="hidden w-80 shrink-0 @3xl/main:block">
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-4 p-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Preview</h3>
            <Badge variant="outline" className="text-[10px]">
              Step {step}: {stepLabels[step - 1]}
            </Badge>
          </div>

          {/* Empty state when nothing is selected */}
          {platforms.length === 0 && (
            <p className="text-xs text-muted-foreground/50">
              Select platforms to see a live preview of your content.
            </p>
          )}

          {/* Platform preview cards */}
          {platforms.length > 0 && (
            <div className="space-y-4">
              {platforms.map((platform) => (
                <PlatformPreviewCard
                  key={platform}
                  platform={platform}
                  prompt={content.prompt}
                  outline={outlineByPlatform[platform] ?? []}
                  aspectRatio={settings.aspectRatioPerPlatform[platform] ?? "1:1"}
                  accentColor={accentColor}
                />
              ))}
            </div>
          )}

          {/* Brand section */}
          {(hasBrand || colorOverride) && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Brand</h4>

                {hasBrand && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">{brandIdentity.name}</p>
                    {brandIdentity.tagline && (
                      <p className="text-[10px] text-muted-foreground italic">
                        &quot;{brandIdentity.tagline}&quot;
                      </p>
                    )}
                    {brandIdentity.logoAssetId && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ImageIcon className="size-2.5" />
                        <span>Logo included</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Color swatches */}
                {(accentColor || bgColor) && (
                  <div className="flex items-center gap-2">
                    {accentColor && (
                      <div className="flex items-center gap-1">
                        <div
                          className="size-4 rounded border"
                          style={{ backgroundColor: accentColor }}
                        />
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {accentColor}
                        </span>
                      </div>
                    )}
                    {bgColor && (
                      <div className="flex items-center gap-1">
                        <div
                          className="size-4 rounded border"
                          style={{ backgroundColor: bgColor }}
                        />
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {bgColor}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Style badges */}
          {styleIds.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Style</h4>
                <div className="flex flex-wrap gap-1">
                  {styleIds.map((id) => (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {styles?.find((s) => s.id === id)?.name ?? "Style"}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Generation summary */}
          {platforms.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Generation</h4>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Output count</span>
                    <span className="font-medium">
                      {estimatedOutputs} item{estimatedOutputs !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <div className="flex items-center gap-1">
                      {settings.model === "flash" ? (
                        <ZapIcon className="size-3 text-amber-500" />
                      ) : (
                        <CrownIcon className="size-3 text-purple-500" />
                      )}
                      <span className="font-medium capitalize">{settings.model}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Variations</span>
                    <span className="font-medium">{settings.variations} per platform</span>
                  </div>
                  {settings.includeLogo && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ImageIcon className="size-2.5" />
                      <span>Logo included</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
