# Optimistic Updates & Cache Scoping Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Add optimistic updates to all mutations across the dashboard and scope cache invalidation to specific query keys (eliminating full cache nukes).
**Depends on:** None (can be applied at any time, touches all hook files)
**Architecture:** Each mutation hook gains `onMutate` (optimistic update + snapshot), `onError` (rollback + toast), and `onSettled` (scoped invalidation). The pattern: cancel in-flight queries, snapshot current cache, apply optimistic change, return snapshot for rollback. This makes the app feel instant -- no waiting for server roundtrip before UI updates. All `queryClient.invalidateQueries()` calls without a key (full cache nuke) are replaced with scoped invalidations.
**Tech Stack:** TanStack Query (`useMutation`, `useQueryClient`), tRPC v11 query keys, Sonner (toast)

---

## Optimistic Update Pattern Reference

Every mutation follows this pattern:

```typescript
export function useCreateThing() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.thing.create.mutationOptions(),
    onMutate: async (newThing) => {
      // 1. Cancel in-flight queries that we're about to update
      await queryClient.cancelQueries({ queryKey: trpc.thing.list.queryKey() });
      // 2. Snapshot current cache for rollback
      const previous = queryClient.getQueryData(trpc.thing.list.queryKey());
      // 3. Optimistic update
      queryClient.setQueryData(trpc.thing.list.queryKey(), (old: any[] | undefined) => [
        { ...newThing, id: `temp-${Date.now()}`, createdAt: new Date() },
        ...(old ?? []),
      ]);
      // 4. Return snapshot
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.thing.list.queryKey(), context.previous);
      }
      toast.error("Failed to create thing");
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: trpc.thing.list.queryKey() });
    },
  });
}
```

**Important notes for the implementer:**
- The `previous` snapshot must be stored in `onMutate` return value and accessed via `context` in `onError`
- `onSettled` fires on both success and error -- use it for invalidation instead of `onSuccess`
- For delete mutations, filter the item from the cached array
- For update mutations, map over the cached array and replace the matching item
- Some mutations (like `useDuplicateBrandIdentity`) cannot be optimistic because they depend on server-generated data -- for these, just scope the invalidation

---

## Task 1: Update `src/hooks/use-projects.ts`

Replace the entire file with:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useProjects() {
  const trpc = useTRPC();
  return useQuery(trpc.project.list.queryOptions());
}

export function useProject(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.project.get.queryOptions({ id }));
}

export function useCreateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.create.mutationOptions(),
    onMutate: async (newProject) => {
      await queryClient.cancelQueries({ queryKey: trpc.project.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.project.list.queryKey());
      queryClient.setQueryData(trpc.project.list.queryKey(), (old: any[] | undefined) => [
        {
          ...newProject,
          id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          orgId: "",
          _count: { campaigns: 0, posts: 0 },
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.project.list.queryKey(), context.previous);
      }
      toast.error("Failed to create project");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}

export function useUpdateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.update.mutationOptions(),
    onMutate: async (updatedProject) => {
      await queryClient.cancelQueries({ queryKey: trpc.project.list.queryKey() });
      await queryClient.cancelQueries({
        queryKey: trpc.project.get.queryKey({ id: updatedProject.id }),
      });
      const previousList = queryClient.getQueryData(trpc.project.list.queryKey());
      const previousDetail = queryClient.getQueryData(
        trpc.project.get.queryKey({ id: updatedProject.id })
      );
      // Optimistic update in list
      queryClient.setQueryData(trpc.project.list.queryKey(), (old: any[] | undefined) =>
        (old ?? []).map((p: any) =>
          p.id === updatedProject.id ? { ...p, ...updatedProject } : p
        )
      );
      // Optimistic update in detail
      queryClient.setQueryData(
        trpc.project.get.queryKey({ id: updatedProject.id }),
        (old: any) => (old ? { ...old, ...updatedProject } : old)
      );
      return { previousList, previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(trpc.project.list.queryKey(), context.previousList);
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(
          trpc.project.get.queryKey({ id: variables.id }),
          context.previousDetail
        );
      }
      toast.error("Failed to update project");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
      queryClient.invalidateQueries({
        queryKey: trpc.project.get.queryKey({ id: variables.id }),
      });
    },
  });
}

export function useDeleteProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.delete.mutationOptions(),
    onMutate: async (deletedProject) => {
      await queryClient.cancelQueries({ queryKey: trpc.project.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.project.list.queryKey());
      queryClient.setQueryData(trpc.project.list.queryKey(), (old: any[] | undefined) =>
        (old ?? []).filter((p: any) => p.id !== deletedProject.id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.project.list.queryKey(), context.previous);
      }
      toast.error("Failed to delete project");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}
```

---

## Task 2: Update `src/hooks/use-campaigns.ts`

Replace the entire file with:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useCampaigns(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.campaign.list.queryOptions({ projectId }));
}

export function useCampaign(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.campaign.get.queryOptions({ id }));
}

export function useCreateCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.create.mutationOptions(),
    onMutate: async (newCampaign) => {
      const listKey = trpc.campaign.list.queryKey({ projectId: newCampaign.projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: any[] | undefined) => [
        {
          ...newCampaign,
          id: `temp-${Date.now()}`,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          brandIdentity: null,
          _count: { posts: 0, contentIdeas: 0 },
        },
        ...(old ?? []),
      ]);
      return { previous, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error("Failed to create campaign");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.update.mutationOptions(),
    onMutate: async (updatedCampaign) => {
      const detailKey = trpc.campaign.get.queryKey({ id: updatedCampaign.id });
      await queryClient.cancelQueries({ queryKey: detailKey });
      // Also cancel any list queries (we don't know projectId here, so cancel all campaign.list)
      await queryClient.cancelQueries({ queryKey: trpc.campaign.list.queryKey() });

      const previousDetail = queryClient.getQueryData(detailKey);

      // Optimistic update in detail cache
      queryClient.setQueryData(detailKey, (old: any) =>
        old ? { ...old, ...updatedCampaign } : old
      );

      // Optimistic update in all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.campaign.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((c: any) =>
            c.id === updatedCampaign.id ? { ...c, ...updatedCampaign } : c
          )
      );

      return { previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(
          trpc.campaign.get.queryKey({ id: variables.id }),
          context.previousDetail
        );
      }
      // For list caches, just invalidate on error to restore server state
      queryClient.invalidateQueries({ queryKey: trpc.campaign.list.queryKey() });
      toast.error("Failed to update campaign");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.get.queryKey({ id: variables.id }),
      });
      queryClient.invalidateQueries({ queryKey: trpc.campaign.list.queryKey() });
    },
  });
}

export function useDeleteCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.delete.mutationOptions(),
    onMutate: async (deletedCampaign) => {
      await queryClient.cancelQueries({ queryKey: trpc.campaign.list.queryKey() });
      // We don't know projectId, so snapshot all campaign list queries
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient.getQueriesData({ queryKey: trpc.campaign.list.queryKey() }).forEach(
        ([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        }
      );

      // Remove from all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.campaign.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((c: any) => c.id !== deletedCampaign.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      // Rollback all list caches
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete campaign");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.campaign.list.queryKey() });
    },
  });
}
```

---

## Task 3: Update `src/hooks/use-brand-identities.ts`

Replace the entire file with:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useBrandIdentities(projectId: string | null | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.brandIdentity.list.queryOptions({ projectId: projectId ?? "" }),
    enabled: !!projectId,
  });
}

export function useBrandIdentity(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.brandIdentity.get.queryOptions({ id }));
}

export function useCreateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.create.mutationOptions(),
    onMutate: async (newBrand) => {
      const listKey = trpc.brandIdentity.list.queryKey({ projectId: newBrand.projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: any[] | undefined) => [
        {
          ...newBrand,
          id: `temp-${Date.now()}`,
          logoAssetId: null,
          logoR2Key: null,
          orgId: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          palettes: [],
        },
        ...(old ?? []),
      ]);
      return { previous, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error("Failed to create brand identity");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.update.mutationOptions(),
    onMutate: async (updatedBrand) => {
      const detailKey = trpc.brandIdentity.get.queryKey({ id: updatedBrand.id });
      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: trpc.brandIdentity.list.queryKey() });

      const previousDetail = queryClient.getQueryData(detailKey);

      // Optimistic update in detail cache
      queryClient.setQueryData(detailKey, (old: any) =>
        old ? { ...old, ...updatedBrand } : old
      );

      // Optimistic update in all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.brandIdentity.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((b: any) =>
            b.id === updatedBrand.id ? { ...b, ...updatedBrand } : b
          )
      );

      return { previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(
          trpc.brandIdentity.get.queryKey({ id: variables.id }),
          context.previousDetail
        );
      }
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      toast.error("Failed to update brand identity");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.get.queryKey({ id: variables.id }),
      });
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
    },
  });
}

export function useDuplicateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.duplicate.mutationOptions(),
    // No optimistic update -- server generates new data (id, copy name, palettes)
    onError: () => {
      toast.error("Failed to duplicate brand identity");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
    },
  });
}

export function useDeleteBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.delete.mutationOptions(),
    onMutate: async (deletedBrand) => {
      await queryClient.cancelQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.brandIdentity.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      queryClient.setQueriesData(
        { queryKey: trpc.brandIdentity.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((b: any) => b.id !== deletedBrand.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete brand identity");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
    },
  });
}

export function useAddPalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.addPalette.mutationOptions(),
    // No optimistic update for nested data -- server generates palette id
    onError: () => {
      toast.error("Failed to add palette");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.get.queryKey() });
    },
  });
}

export function useRemovePalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.removePalette.mutationOptions(),
    onMutate: async (removedPalette) => {
      await queryClient.cancelQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.brandIdentity.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      // Remove palette from cached brand list data
      queryClient.setQueriesData(
        { queryKey: trpc.brandIdentity.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((brand: any) => ({
            ...brand,
            palettes: brand.palettes?.filter(
              (p: any) => p.id !== removedPalette.paletteId
            ),
          }))
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to remove palette");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.brandIdentity.get.queryKey() });
    },
  });
}
```

---

## Task 4: Update `src/hooks/use-content.ts`

Replace the entire file with:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useSources(projectId?: string) {
  const trpc = useTRPC();
  return useQuery(trpc.content.listSources.queryOptions({ projectId }));
}

export function useCreateSource() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.createSource.mutationOptions(),
    onMutate: async (newSource) => {
      const listKey = trpc.content.listSources.queryKey({ projectId: newSource.projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: any[] | undefined) => [
        {
          ...newSource,
          id: `temp-${Date.now()}`,
          orgId: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: { ideas: 0 },
        },
        ...(old ?? []),
      ]);
      return { previous, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error("Failed to create content source");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.content.listSources.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useDeleteSource() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.deleteSource.mutationOptions(),
    onMutate: async (deletedSource) => {
      await queryClient.cancelQueries({ queryKey: trpc.content.listSources.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.content.listSources.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      queryClient.setQueriesData(
        { queryKey: trpc.content.listSources.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((s: any) => s.id !== deletedSource.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete content source");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.content.listSources.queryKey() });
      // Also invalidate ideas since deleting a source cascades
      queryClient.invalidateQueries({ queryKey: trpc.content.listIdeas.queryKey() });
    },
  });
}

export function useIdeas(filters?: {
  projectId?: string;
  sourceId?: string;
  contentType?: string;
  isSaved?: boolean;
  campaignId?: string;
}) {
  const trpc = useTRPC();
  return useQuery(trpc.content.listIdeas.queryOptions(filters ?? {}));
}

export function useToggleIdeaSave() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.toggleIdeaSave.mutationOptions(),
    onMutate: async (toggledIdea) => {
      await queryClient.cancelQueries({ queryKey: trpc.content.listIdeas.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.content.listIdeas.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      // Optimistic toggle of isSaved in all idea list caches
      queryClient.setQueriesData(
        { queryKey: trpc.content.listIdeas.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((idea: any) =>
            idea.id === toggledIdea.id
              ? { ...idea, isSaved: !idea.isSaved }
              : idea
          )
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to update idea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.content.listIdeas.queryKey() });
    },
  });
}

export function useBulkDeleteIdeas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.bulkDeleteIdeas.mutationOptions(),
    onMutate: async (deletedIdeas) => {
      await queryClient.cancelQueries({ queryKey: trpc.content.listIdeas.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.content.listIdeas.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      const deletedIds = new Set(deletedIdeas.ids);
      queryClient.setQueriesData(
        { queryKey: trpc.content.listIdeas.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((idea: any) => !deletedIds.has(idea.id))
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete ideas");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.content.listIdeas.queryKey() });
      // Also invalidate sources since idea count may change
      queryClient.invalidateQueries({ queryKey: trpc.content.listSources.queryKey() });
    },
  });
}
```

---

## Task 5: Update `src/hooks/use-assets.ts`

Replace the entire file with:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useAssets(opts?: {
  projectId?: string | null;
  category?: "reference" | "asset";
}) {
  const trpc = useTRPC();
  return useQuery(
    trpc.asset.list.queryOptions({
      projectId: opts?.projectId ?? undefined,
      category: opts?.category,
    })
  );
}

export function useMoveAsset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.asset.move.mutationOptions(),
    onMutate: async (movedAsset) => {
      await queryClient.cancelQueries({ queryKey: trpc.asset.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.asset.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      // Optimistic update: change projectId in all list caches
      queryClient.setQueriesData(
        { queryKey: trpc.asset.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).map((a: any) =>
            a.id === movedAsset.id
              ? { ...a, projectId: movedAsset.projectId }
              : a
          )
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to move asset");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}

export function useDeleteAsset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.asset.delete.mutationOptions(),
    onMutate: async (deletedAsset) => {
      await queryClient.cancelQueries({ queryKey: trpc.asset.list.queryKey() });
      const previousQueries: { queryKey: unknown; data: unknown }[] = [];
      queryClient
        .getQueriesData({ queryKey: trpc.asset.list.queryKey() })
        .forEach(([queryKey, data]) => {
          previousQueries.push({ queryKey, data });
        });

      queryClient.setQueriesData(
        { queryKey: trpc.asset.list.queryKey() },
        (old: any[] | undefined) =>
          (old ?? []).filter((a: any) => a.id !== deletedAsset.id)
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey as any, data);
      });
      toast.error("Failed to delete asset");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}

// Upload uses REST route, not tRPC
export function useUploadAsset() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      file: File;
      category: "reference" | "asset";
      projectId?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", params.file);
      formData.append("category", params.category);
      if (params.projectId) formData.append("projectId", params.projectId);
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      return res.json();
    },
    // No optimistic update for upload -- we don't have the r2Key until server responds
    onError: () => {
      toast.error("Failed to upload asset");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
    },
  });
}
```

---

## Task 6: Update `src/hooks/use-favorites.ts`

Replace the entire file with:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useFavorites() {
  const trpc = useTRPC();
  return useQuery(trpc.favorite.list.queryOptions());
}

export function useAddFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.add.mutationOptions(),
    onMutate: async (newFavorite) => {
      await queryClient.cancelQueries({ queryKey: trpc.favorite.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.favorite.list.queryKey());
      queryClient.setQueryData(trpc.favorite.list.queryKey(), (old: any[] | undefined) => [
        ...(old ?? []),
        {
          ...newFavorite,
          id: `temp-${Date.now()}`,
          userId: "",
          order: (old?.length ?? 0),
          createdAt: new Date().toISOString(),
        },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.favorite.list.queryKey(), context.previous);
      }
      toast.error("Failed to add favorite");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useRemoveFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.remove.mutationOptions(),
    onMutate: async (removedFavorite) => {
      await queryClient.cancelQueries({ queryKey: trpc.favorite.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.favorite.list.queryKey());
      queryClient.setQueryData(trpc.favorite.list.queryKey(), (old: any[] | undefined) =>
        (old ?? []).filter(
          (f: any) =>
            !(
              f.targetType === removedFavorite.targetType &&
              f.targetId === removedFavorite.targetId
            )
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.favorite.list.queryKey(), context.previous);
      }
      toast.error("Failed to remove favorite");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useReorderFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.reorder.mutationOptions(),
    // Optimistic reorder is handled by the caller (NavFavorites component)
    // since the component has the reordered array ready
    onError: () => {
      toast.error("Failed to reorder favorites");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}
```

---

## Important Notes for Implementer

1. **Callsite toast handlers**: Some pages currently pass `onError: (err) => toast.error(...)` at the callsite (e.g. in `brands/page.tsx`). These callsite handlers run IN ADDITION to the hook-level `onError`. Depending on preference, either:
   - Remove callsite `onError` toast handlers (let the hook handle it), OR
   - Keep both (user sees the toast from the hook; the callsite can do additional cleanup like closing a dialog)

   The recommended approach: keep the hook-level toast as a catch-all, and let callsites override with more specific messages if needed. Since TanStack Query's `useMutation` merges `onError` handlers (hook-level runs first, then callsite), the user may see duplicate toasts. To avoid this, remove callsite `toast.error()` calls and only use callsite `onError` for non-toast side effects (like closing dialogs).

2. **Type safety**: The optimistic update code uses `any` for cache data types. This is intentional -- the cache data shape is inferred by tRPC at runtime. If stricter typing is desired, extract the return types from the tRPC router (e.g., `type ProjectListItem = Awaited<ReturnType<typeof trpc.project.list.query>>[number]`).

3. **Temp IDs**: Optimistic creates use `temp-${Date.now()}` as the ID. This means React keys will change when the real data arrives (via `onSettled` invalidation). This causes a brief re-render but is harmless. If it causes visual flicker, consider using `useMemo` to stabilize the list.

---

## Verification Checklist

1. Creating a project/campaign/brand instantly appears in the list (no loading delay)
2. Deleting an item instantly removes it from the list
3. Updating an item instantly reflects changes in both list and detail views
4. Toggling idea save instantly flips the bookmark icon
5. If any mutation fails, the UI rolls back to the previous state and shows an error toast
6. No full-cache nukes (`queryClient.invalidateQueries()` without a key) remain
7. After server settles, data is always re-validated via scoped `onSettled` invalidation

---

## Files Modified

| File | Action |
|------|--------|
| `src/hooks/use-projects.ts` | Optimistic create/update/delete with scoped invalidation |
| `src/hooks/use-campaigns.ts` | Optimistic create/update/delete with scoped invalidation |
| `src/hooks/use-brand-identities.ts` | Optimistic create/update/delete/removePalette, scoped invalidation for all |
| `src/hooks/use-content.ts` | Optimistic create/delete source, toggle save, bulk delete ideas |
| `src/hooks/use-assets.ts` | Optimistic delete/move, scoped invalidation for upload |
| `src/hooks/use-favorites.ts` | Optimistic add/remove, scoped invalidation |
