"use client";

import { StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites, useAddFavorite, useRemoveFavorite } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FavoriteStarProps {
  targetType: "project" | "campaign" | "route";
  targetId: string;
}

export function FavoriteStar({ targetType, targetId }: FavoriteStarProps) {
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const isFavorited = favorites?.some(
    (f) => f.targetType === targetType && f.targetId === targetId
  );

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFavorited) {
      removeFavorite.mutate({ targetType, targetId }, { onError: (err) => toast.error(err.message ?? "Operation failed") });
    } else {
      addFavorite.mutate({ targetType, targetId }, { onError: (err) => toast.error(err.message ?? "Operation failed") });
    }
  };

  return (
    <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={toggle}>
      <StarIcon
        className={cn(
          "size-4",
          isFavorited ? "fill-sidebar-foreground text-sidebar-foreground" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
