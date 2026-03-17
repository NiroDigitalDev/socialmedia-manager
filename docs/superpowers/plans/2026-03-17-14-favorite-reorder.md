# Favorite Reorder (Drag-and-Drop) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Add drag-and-drop reorder to sidebar favorites using @dnd-kit so users can arrange their favorite items in a custom order.
**Depends on:** None
**Architecture:** The `NavFavorites` component currently renders a flat `SidebarMenu` list ordered by the `order` field from the database. We wrap it with `DndContext` + `SortableContext` from @dnd-kit, make each favorite item a sortable element with `useSortable()`, and on drag end we optimistically reorder the cache and call the existing `favorite.reorder` tRPC mutation which does a transactional batch update of `order` values.
**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (all already installed), tRPC v11, TanStack Query, shadcn Sidebar primitives, Zustand

---

## Task 0: Verify @dnd-kit packages are installed

The packages are already in `package.json`:
- `@dnd-kit/core`: ^6.3.1
- `@dnd-kit/sortable`: ^10.0.0
- `@dnd-kit/utilities`: ^3.2.2

No installation needed. If they are missing for any reason: `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

---

## Task 1: Rewrite NavFavorites with drag-and-drop

**File:** `src/components/nav-favorites.tsx`

Replace the entire file with the following:

```typescript
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

interface FavoriteItem {
  id: string;
  targetType: string;
  targetId: string;
  order: number;
  userId: string;
  createdAt: string | Date;
}

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

  return (
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
}

// ---------- NavFavorites ----------

export function NavFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: favorites } = useFavorites();
  const { data: projects } = useProjects();
  const reorder = useReorderFavorites();
  const { favoritesCollapsed, toggleFavorites } = useSidebarStore();

  // Filter out campaign favorites since we can't resolve their URL without projectId
  const displayFavorites =
    favorites?.filter((f) => f.targetType !== "campaign") ?? [];

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
        (old: FavoriteItem[] | undefined) => {
          if (!old) return old;
          const reorderedFull = arrayMove(
            [...old],
            old.findIndex((f) => f.id === active.id),
            old.findIndex((f) => f.id === over!.id)
          );
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
```

---

## Key Design Decisions

1. **Drag handle pattern**: The `GripVerticalIcon` appears on hover (`opacity-0 group-hover/fav:opacity-100`), keeping the UI clean. The handle uses `{...attributes}` and `{...listeners}` from `useSortable()` so only the grip area initiates drag, allowing the rest of the row to remain clickable as a link.

2. **Activation constraint**: `PointerSensor` has `activationConstraint: { distance: 5 }` so a small mouse movement doesn't accidentally start a drag when trying to click the link.

3. **Optimistic update**: On drag end, we immediately update the TanStack Query cache via `queryClient.setQueryData()` using `arrayMove` on the full favorites list (not just the filtered `displayFavorites`). The order field is recalculated as the array index. On error, we rollback by invalidating the query (refetch from server). On settle, we always invalidate to ensure server-client consistency.

4. **SortableContext items**: We pass `displayFavorites.map(f => f.id)` as the items array, which must match the `id` passed to `useSortable()` in each child.

---

## Verification Checklist

1. Favorites list renders identically to before when not dragging
2. Hovering a favorite item reveals the grip handle on the left
3. Dragging a favorite by the grip handle reorders the list visually in real-time
4. Releasing the drag sends the new order to the server via `favorite.reorder` mutation
5. If the mutation fails, the list reverts to server state and shows an error toast
6. Clicking a favorite link still navigates correctly (drag doesn't hijack clicks)
7. Keyboard reorder works via `KeyboardSensor`

---

## Files Modified

| File | Action |
|------|--------|
| `src/components/nav-favorites.tsx` | Full rewrite with DndContext, SortableContext, useSortable, optimistic reorder |
