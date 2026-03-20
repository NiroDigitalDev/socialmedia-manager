"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontalIcon,
  Trash2Icon,
  ShuffleIcon,
  MergeIcon,
  PlusIcon,
  EyeIcon,
  TypeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORM_SHORT: Record<string, string> = {
  instagram: "IG",
  linkedin: "LinkedIn",
  x: "X",
  reddit: "Reddit",
  blog: "Blog",
  email: "Email",
};

function getStyleBadge(style: StyleCardStyle): string {
  const kind = style.kind ?? "image";
  const platform = style.platforms?.[0];
  const platformLabel = platform ? PLATFORM_SHORT[platform] ?? platform : null;
  const kindLabel = kind === "caption" ? "Caption" : "Post";
  if (platformLabel) return `${platformLabel} ${kindLabel}`;
  return kind === "caption" ? "Caption" : "Image";
}

export interface StyleCardStyle {
  id: string;
  name: string;
  description?: string | null;
  promptText: string;
  isPredefined: boolean;
  kind?: string;
  sampleImageIds: string[];
  sampleImageUrls?: string[];
  sampleTexts?: string[];
  referenceImageId?: string | null;
  platforms?: string[];
  parentStyleIds?: string[];
}

interface StyleCardProps {
  style: StyleCardStyle;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  onRemix?: () => void;
  onBlend?: () => void;
  onInspect?: () => void;
}

export function StyleCard({
  style,
  selected,
  onSelect,
  onDelete,
  onRemix,
  onBlend,
  onInspect,
}: StyleCardProps) {
  const isCaption = (style.kind ?? "image") === "caption";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all bg-gradient-to-t from-primary/5 to-card dark:bg-card gap-0 py-0",
        selected && "ring-2 ring-primary bg-primary/5",
        onSelect && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {/* Preview Area */}
      <div className={cn("aspect-square overflow-hidden", isCaption ? "bg-background" : "bg-muted")}>
        {isCaption ? (
          /* Caption style: clean lined-paper look */
          <div className="flex h-full flex-col justify-center px-5 py-4">
            {(style.sampleTexts ?? []).length > 0 ? (
              <div className="space-y-3">
                {(style.sampleTexts ?? []).slice(0, 2).map((text, i) => (
                  <p
                    key={i}
                    className={cn(
                      "line-clamp-4 text-xs leading-relaxed text-foreground/70",
                      i === 0 && "text-foreground/90"
                    )}
                  >
                    {text}
                  </p>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <TypeIcon className="size-8 text-muted-foreground/20" />
              </div>
            )}
          </div>
        ) : (
          /* Image style: 2x2 grid */
          <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5">
            {[0, 1, 2, 3].map((idx) => {
              const imgUrl = style.sampleImageUrls?.[idx];
              return imgUrl ? (
                <img
                  key={idx}
                  src={imgUrl}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  key={idx}
                  className="flex items-center justify-center border border-dashed border-muted-foreground/20 bg-muted/50"
                >
                  <PlusIcon className="size-3 text-muted-foreground/30" />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <CardHeader className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-sm">{style.name}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {getStyleBadge(style)}
          </Badge>
        </div>
        {style.description && (
          <CardDescription className="line-clamp-2 text-xs">
            {style.description}
          </CardDescription>
        )}
        {style.parentStyleIds && style.parentStyleIds.length === 1 && (
          <p className="text-[10px] text-muted-foreground/60">Remixed</p>
        )}
        {style.parentStyleIds && style.parentStyleIds.length === 2 && (
          <p className="text-[10px] text-muted-foreground/60">Blended</p>
        )}
      </CardHeader>
      {/* Actions menu */}
      {(onInspect || onRemix || onBlend || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100 bg-background/80 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onInspect && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onInspect(); }}>
                <EyeIcon className="mr-2 size-3.5" />
                Inspect
              </DropdownMenuItem>
            )}
            {onRemix && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemix(); }}>
                <ShuffleIcon className="mr-2 size-3.5" />
                Remix
              </DropdownMenuItem>
            )}
            {onBlend && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onBlend(); }}>
                <MergeIcon className="mr-2 size-3.5" />
                Blend with...
              </DropdownMenuItem>
            )}
            {!style.isPredefined && onDelete && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2Icon className="mr-2 size-3.5" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Card>
  );
}
