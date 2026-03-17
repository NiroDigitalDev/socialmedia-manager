"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StyleCardStyle {
  id: string;
  name: string;
  description?: string | null;
  promptText: string;
  isPredefined: boolean;
  sampleImageIds: string[];
  referenceImageId?: string | null;
}

interface StyleCardProps {
  style: StyleCardStyle;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

export function StyleCard({
  style,
  selected,
  onSelect,
  onDelete,
}: StyleCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all bg-gradient-to-t from-primary/5 to-card dark:bg-card",
        selected && "ring-2 ring-primary bg-primary/5",
        onSelect && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {/* Preview thumbnails */}
      <div className="aspect-square overflow-hidden bg-muted">
        {style.sampleImageIds.length > 0 ? (
          <div className="grid h-full grid-cols-2 gap-0.5">
            {style.sampleImageIds.slice(0, 2).map((imgId) => (
              <img
                key={imgId}
                src={`/api/images/${imgId}?type=stored`}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ))}
            {style.sampleImageIds.length === 1 && (
              <div className="flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                <span className="text-[10px] text-muted-foreground">+</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <span className="text-xs text-muted-foreground">No preview</span>
          </div>
        )}
      </div>
      <CardHeader className="p-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-sm">{style.name}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {style.isPredefined ? "Predefined" : "Custom"}
          </Badge>
        </div>
        {style.description && (
          <CardDescription className="line-clamp-2 text-xs">
            {style.description}
          </CardDescription>
        )}
      </CardHeader>
      {/* Delete button -- only for custom styles when handler provided */}
      {!style.isPredefined && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100 bg-background/80 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2Icon className="size-3.5 text-destructive" />
        </Button>
      )}
    </Card>
  );
}
