"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  StarIcon,
  FolderIcon,
  FlaskConicalIcon,
  MoreHorizontalIcon,
  GripVerticalIcon,
} from "lucide-react";
import Link from "next/link";
import { useFavorites, useReorderFavorites } from "@/hooks/use-favorites";
import { useProjects } from "@/hooks/use-projects";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { useTRPC } from "@/lib/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  project: FolderIcon,
  campaign: FlaskConicalIcon,
  route: StarIcon,
};

type FavoriteItem = {
  id: string;
  targetType: string;
  targetId: string;
  order: number;
  [key: string]: unknown;
};

// ---------- Sortable row inside reorder popover ----------

function SortableReorderRow({
  fav,
  label,
}: {
  fav: FavoriteItem;
  label: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fav.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = iconMap[fav.targetType] ?? StarIcon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        isDragging && "bg-sidebar-accent"
      )}
    >
      <span
        className="flex shrink-0 cursor-grab items-center active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5 text-muted-foreground" />
      </span>
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

// ---------- Reorder popover ----------

function ReorderPopover({
  favorites,
  getLabel,
}: {
  favorites: FavoriteItem[];
  getLabel: (fav: FavoriteItem) => string;
}) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const reorder = useReorderFavorites();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = favorites.findIndex((f) => f.id === active.id);
      const newIndex = favorites.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(favorites, oldIndex, newIndex);

      queryClient.setQueryData(trpc.favorite.list.queryKey(), (old) => {
        if (!old) return old;
        const oldIdx = old.findIndex((f) => f.id === active.id);
        const newIdx = old.findIndex((f) => f.id === over!.id);
        if (oldIdx === -1 || newIdx === -1) return old;
        const reorderedFull = arrayMove([...old], oldIdx, newIdx);
        return reorderedFull.map((f, i) => ({ ...f, order: i }));
      });

      reorder.mutate(
        reordered.map((f, i) => ({ id: f.id, order: i })),
        {
          onError: () => {
            queryClient.invalidateQueries({
              queryKey: trpc.favorite.list.queryKey(),
            });
            toast.error("Failed to reorder favorites");
          },
          onSettled: () => {
            queryClient.invalidateQueries({
              queryKey: trpc.favorite.list.queryKey(),
            });
          },
        }
      );
    },
    [favorites, queryClient, trpc, reorder]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SidebarGroupAction title="Reorder favorites">
          <MoreHorizontalIcon />
        </SidebarGroupAction>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-56 p-1">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Drag to reorder
        </p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={favorites.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {favorites.map((fav) => (
              <SortableReorderRow
                key={fav.id}
                fav={fav}
                label={getLabel(fav)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}

// ---------- NavFavorites ----------

export function NavFavorites() {
  const { data: favorites } = useFavorites();
  const { data: projects } = useProjects();
  const { favoritesCollapsed, toggleFavorites } = useSidebarStore();

  const displayFavorites = favorites ?? [];

  const getLabel = useCallback(
    (fav: { targetType: string; targetId: string }) => {
      if (fav.targetType === "route")
        return fav.targetId.split("/").pop() ?? fav.targetId;
      if (fav.targetType === "project") {
        return (
          projects?.find((p) => p.id === fav.targetId)?.name ?? "Project"
        );
      }
      return "Campaign";
    },
    [projects]
  );

  const getHref = useCallback(
    (fav: { targetType: string; targetId: string }) => {
      if (fav.targetType === "route") return fav.targetId;
      if (fav.targetType === "project")
        return `/dashboard/projects/${fav.targetId}`;
      return "#";
    },
    []
  );

  if (displayFavorites.length === 0) {
    return null;
  }

  return (
    <Collapsible open={!favoritesCollapsed} onOpenChange={toggleFavorites}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            Favorites
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <ReorderPopover
          favorites={displayFavorites as FavoriteItem[]}
          getLabel={getLabel}
        />
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {displayFavorites.map((fav) => {
                const Icon = iconMap[fav.targetType] ?? StarIcon;
                return (
                  <SidebarMenuItem key={fav.id}>
                    <SidebarMenuButton asChild tooltip={getLabel(fav)}>
                      <Link href={getHref(fav)}>
                        <Icon className="size-4" />
                        <span className="truncate">{getLabel(fav)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
