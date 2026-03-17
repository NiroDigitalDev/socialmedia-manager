# Brand Logo Upload Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Add logo upload to the brand identity editor so brand cards show actual logos instead of placeholder icons.
**Depends on:** None (brand edit dialog already exists, asset upload works via REST)
**Architecture:** The brand card currently renders a static `<ImageIcon>` placeholder. We add a logo section to the edit dialog that uses the existing `useUploadAsset()` hook (REST upload to R2) to upload an image, then calls `useUpdateBrandIdentity()` to persist the `logoAssetId`. The `brandIdentity.list` tRPC query is updated to include the logo asset's `r2Key` so the card can render the image from the R2 public URL. No new routes or models needed -- everything is wired through existing infrastructure.
**Tech Stack:** tRPC v11, TanStack Query, `useUploadAsset()` (REST), R2 public URL, shadcn Dialog/Button/Skeleton, Lucide icons

---

## Task 1: Update the brand identity tRPC list query to include logo asset data

**File:** `src/lib/trpc/routers/brand-identity.ts`

The `list` query currently does `include: { palettes: true }` but does not join the logo asset. Since `logoAssetId` is a plain string field (not a Prisma relation), we need to manually look up the asset after fetching. Alternatively, add a Prisma relation to `BrandIdentity` for the logo asset -- but that requires a schema change. The simpler approach: do a manual lookup of logo assets after the query.

Replace the `list` query implementation:

```typescript
list: orgProtectedProcedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ ctx, input }) => {
    const project = await ctx.prisma.project.findFirst({
      where: { id: input.projectId, orgId: ctx.orgId },
    });
    if (!project) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    const brands = await ctx.prisma.brandIdentity.findMany({
      where: { projectId: input.projectId },
      include: { palettes: true },
      orderBy: { createdAt: "desc" },
    });

    // Resolve logo asset r2Keys for brands that have a logoAssetId
    const logoAssetIds = brands
      .map((b) => b.logoAssetId)
      .filter((id): id is string => !!id);

    let logoAssetMap: Record<string, string> = {};
    if (logoAssetIds.length > 0) {
      const assets = await ctx.prisma.asset.findMany({
        where: { id: { in: logoAssetIds } },
        select: { id: true, r2Key: true },
      });
      logoAssetMap = Object.fromEntries(assets.map((a) => [a.id, a.r2Key]));
    }

    return brands.map((brand) => ({
      ...brand,
      logoR2Key: brand.logoAssetId
        ? logoAssetMap[brand.logoAssetId] ?? null
        : null,
    }));
  }),
```

Also update the `get` query to include the same logo resolution:

```typescript
get: orgProtectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const identity = await ctx.prisma.brandIdentity.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      include: { palettes: true },
    });
    if (!identity) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
    }

    let logoR2Key: string | null = null;
    if (identity.logoAssetId) {
      const asset = await ctx.prisma.asset.findUnique({
        where: { id: identity.logoAssetId },
        select: { r2Key: true },
      });
      logoR2Key = asset?.r2Key ?? null;
    }

    return { ...identity, logoR2Key };
  }),
```

**Verification:** After this change, the list and get queries return a `logoR2Key` field alongside the existing data. This is `null` when no logo is set, or the R2 key string when one exists.

---

## Task 2: Update the brands page to show logos and add upload functionality

**File:** `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx`

This is the main file. The complete updated code follows.

### 2a. Add imports

Add these imports at the top of the file (alongside existing ones):

```typescript
import { useRef } from "react";
import { UploadIcon, Loader2Icon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUploadAsset } from "@/hooks/use-assets";
```

The full import block becomes:

```typescript
"use client";

import { use, useState, useRef } from "react";
import {
  PaletteIcon,
  PlusIcon,
  MoreHorizontalIcon,
  CopyIcon,
  PencilIcon,
  TrashIcon,
  ImageIcon,
  XIcon,
  UploadIcon,
  Loader2Icon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  useBrandIdentities,
  useCreateBrandIdentity,
  useUpdateBrandIdentity,
  useDuplicateBrandIdentity,
  useDeleteBrandIdentity,
  useAddPalette,
  useRemovePalette,
} from "@/hooks/use-brand-identities";
import { useUploadAsset } from "@/hooks/use-assets";
import { toast } from "sonner";
```

### 2b. Add R2 public URL constant and upload ref

Inside the component function, add:

```typescript
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

const uploadAsset = useUploadAsset();
const logoFileInputRef = useRef<HTMLInputElement>(null);
```

### 2c. Replace the logo placeholder in the brand card

Find this block in the card rendering (inside `CardContent`):

```typescript
{/* Logo placeholder */}
<div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-muted">
  <ImageIcon className="size-6 text-muted-foreground" />
</div>
```

Replace with:

```typescript
{/* Logo */}
<div className="mb-3 flex size-12 items-center justify-center overflow-hidden rounded-lg bg-muted">
  {brand.logoR2Key ? (
    <img
      src={`${R2_PUBLIC_URL}/${brand.logoR2Key}`}
      alt={`${brand.name} logo`}
      className="size-12 object-cover"
    />
  ) : (
    <ImageIcon className="size-6 text-muted-foreground" />
  )}
</div>
```

### 2d. Add logo upload section to the edit dialog

Find the edit dialog's form content (the `<div className="grid gap-4 py-4">` inside the edit dialog). It currently has two fields: name and tagline. Add a logo section after the tagline field:

**Current edit dialog form:**
```typescript
<div className="grid gap-4 py-4">
  <div className="grid gap-2">
    <Label htmlFor="edit-brand-name">Name</Label>
    <Input ... />
  </div>
  <div className="grid gap-2">
    <Label htmlFor="edit-brand-tagline">Tagline</Label>
    <Input ... />
  </div>
</div>
```

**Updated edit dialog form (add after tagline field, before closing `</div>`):**
```typescript
<div className="grid gap-4 py-4">
  <div className="grid gap-2">
    <Label htmlFor="edit-brand-name">Name</Label>
    <Input
      id="edit-brand-name"
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleEdit();
      }}
    />
  </div>
  <div className="grid gap-2">
    <Label htmlFor="edit-brand-tagline">Tagline</Label>
    <Input
      id="edit-brand-tagline"
      value={editTagline}
      onChange={(e) => setEditTagline(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleEdit();
      }}
    />
  </div>

  {/* Logo upload section */}
  <div className="grid gap-2">
    <Label>Logo</Label>
    <div className="flex items-center gap-3">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
        {editingBrand && (() => {
          const currentBrand = brands?.find((b) => b.id === editingBrand.id);
          if (currentBrand?.logoR2Key) {
            return (
              <img
                src={`${R2_PUBLIC_URL}/${currentBrand.logoR2Key}`}
                alt="Current logo"
                className="size-16 object-cover"
              />
            );
          }
          return <ImageIcon className="size-8 text-muted-foreground" />;
        })()}
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          ref={logoFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !editingBrand) return;
            uploadAsset.mutate(
              { file, category: "asset", projectId: id },
              {
                onSuccess: (data: { id: string }) => {
                  updateBrand.mutate(
                    { id: editingBrand.id, logoAssetId: data.id },
                    {
                      onSuccess: () => toast.success("Logo uploaded"),
                      onError: (err) =>
                        toast.error(err.message ?? "Failed to set logo"),
                    }
                  );
                },
                onError: (err) =>
                  toast.error(err.message ?? "Failed to upload logo"),
              }
            );
            // Reset input so the same file can be re-selected
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadAsset.isPending}
          onClick={() => logoFileInputRef.current?.click()}
        >
          {uploadAsset.isPending ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <UploadIcon className="mr-2 size-4" />
              Upload Logo
            </>
          )}
        </Button>
        {editingBrand &&
          brands?.find((b) => b.id === editingBrand.id)?.logoR2Key && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (!editingBrand) return;
                updateBrand.mutate(
                  { id: editingBrand.id, logoAssetId: null },
                  {
                    onSuccess: () => toast.success("Logo removed"),
                    onError: (err) =>
                      toast.error(
                        err.message ?? "Failed to remove logo"
                      ),
                  }
                );
              }}
            >
              <TrashIcon className="mr-2 size-4" />
              Remove Logo
            </Button>
          )}
      </div>
    </div>
  </div>
</div>
```

### 2e. TypeScript type note

The `brands` array returned by the updated tRPC query now includes `logoR2Key: string | null`. Since tRPC infers types automatically, the component will pick up this new field without any manual type definitions.

---

## Verification Checklist

1. Brand cards show the actual logo image when `logoR2Key` is present, falling back to `<ImageIcon>` placeholder when null
2. Edit dialog shows current logo preview or placeholder
3. "Upload Logo" button triggers file picker, uploads via REST, then updates `logoAssetId` via tRPC mutation
4. Loading spinner shows during upload
5. "Remove Logo" button appears only when a logo exists, sets `logoAssetId` to `null`
6. The `brandIdentity.list` and `brandIdentity.get` tRPC queries return `logoR2Key`
7. All mutations have `onError` toast handlers

---

## Files Modified

| File | Action |
|------|--------|
| `src/lib/trpc/routers/brand-identity.ts` | Update `list` and `get` queries to resolve logo asset r2Key |
| `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx` | Add logo display on cards, logo upload section in edit dialog |
