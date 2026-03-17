"use client";

import { useCallback } from "react";
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
  StarIcon,
  FolderIcon,
  FlaskConicalIcon,
  ChevronRightIcon,
  GripVerticalIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { useFavorites, useReorderFavorites } from "@/hooks/use-favorites";
import { useProjects } from "@/hooks/use-projects";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { useTRPC } from "@/lib/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const iconMap: Record<string, React.ElementType> = {
  project: FolderIcon,
  campaign: FlaskConicalIcon,
  route: StarIcon,
};

// ---------- Sortable Favorite Item ----------

type FavoriteItem = {
  id: string;
  targetType: string;
  targetId: string;
  order: number;
  [key: string]: unknown;
};

function SortableFavoriteItem({
  fav,
  label,
  href,
}: {
  fav: FavoriteItem;
  label: string;
  href: string;
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
  const isCampaign = fav.targetType === "campaign";

  const content = (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton asChild tooltip={label}>
        <Link href={href} className="group/fav">
          {/* Drag handle - visible on hover */}
          <span
            className="flex shrink-0 cursor-grab items-center opacity-0 transition-opacity group-hover/fav:opacity-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-3.5 text-muted-foreground" />
          </span>
          <Icon className="size-4" />
          <span className="truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  if (isCampaign) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            <p>Open from project sidebar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// ---------- NavFavorites ----------

export function NavFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: favorites } = useFavorites();
  const { data: projects } = useProjects();
  const reorder = useReorderFavorites();
  const { favoritesCollapsed, toggleFavorites } = useSidebarStore();

  const displayFavorites = favorites ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getLabel = useCallback(
    (fav: { targetType: string; targetId: string }) => {
      if (fav.targetType === "route")
        return fav.targetId.split("/").pop() ?? fav.targetId;
      if (fav.targetType === "project") {
        return projects?.find((p) => p.id === fav.targetId)?.name ?? "Project";
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = displayFavorites.findIndex(
        (f) => f.id === active.id
      );
      const newIndex = displayFavorites.findIndex(
        (f) => f.id === over.id
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(displayFavorites, oldIndex, newIndex);

      // Optimistic update: immediately update the cache
      queryClient.setQueryData(
        trpc.favorite.list.queryKey(),
        (old) => {
          if (!old) return old;
          const oldIdx = old.findIndex((f) => f.id === active.id);
          const newIdx = old.findIndex((f) => f.id === over!.id);
          if (oldIdx === -1 || newIdx === -1) return old;
          const reorderedFull = arrayMove([...old], oldIdx, newIdx);
          return reorderedFull.map((f, i) => ({ ...f, order: i }));
        }
      );

      // Send new order to server
      reorder.mutate(
        reordered.map((f, i) => ({ id: f.id, order: i })),
        {
          onError: () => {
            // Rollback: refetch from server
            queryClient.invalidateQueries({
              queryKey: trpc.favorite.list.queryKey(),
            });
            toast.error("Failed to reorder favorites");
          },
          onSettled: () => {
            // Always refetch to ensure consistency
            queryClient.invalidateQueries({
              queryKey: trpc.favorite.list.queryKey(),
            });
          },
        }
      );
    },
    [displayFavorites, queryClient, trpc, reorder]
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
            <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayFavorites.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <SidebarMenu>
                  {displayFavorites.map((fav) => (
                    <SortableFavoriteItem
                      key={fav.id}
                      fav={fav}
                      label={getLabel(fav)}
                      href={getHref(fav)}
                    />
                  ))}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
