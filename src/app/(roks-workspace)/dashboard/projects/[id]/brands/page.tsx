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
import { PageHeaderSkeleton, BrandCardSkeleton } from "@/components/skeletons";
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

export default function BrandIdentitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: brands, isLoading } = useBrandIdentities(id);
  const createBrand = useCreateBrandIdentity();
  const updateBrand = useUpdateBrandIdentity();
  const duplicateBrand = useDuplicateBrandIdentity();
  const deleteBrand = useDeleteBrandIdentity();
  const addPalette = useAddPalette();
  const removePalette = useRemovePalette();
  const uploadAsset = useUploadAsset();
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");

  // Edit dialog state
  const [editingBrand, setEditingBrand] = useState<{ id: string; name: string; tagline: string } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTagline, setEditTagline] = useState("");

  // Delete dialog state
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);
  const [deletingBrandName, setDeletingBrandName] = useState("");

  // Palette dialog state
  const [paletteDialogBrandId, setPaletteDialogBrandId] = useState<string | null>(null);
  const [paletteName, setPaletteName] = useState("");
  const [paletteAccent, setPaletteAccent] = useState("#6366f1");
  const [paletteBg, setPaletteBg] = useState("#ffffff");

  const handleCreate = () => {
    if (!name.trim()) return;
    createBrand.mutate(
      {
        projectId: id,
        name: name.trim(),
        tagline: tagline.trim() || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setTagline("");
        },
        onError: (err) => toast.error(err.message ?? "Operation failed"),
      }
    );
  };

  const handleEdit = () => {
    if (!editingBrand || !editName.trim()) return;
    updateBrand.mutate(
      {
        id: editingBrand.id,
        name: editName.trim(),
        tagline: editTagline.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
          setEditingBrand(null);
          toast.success("Brand identity updated");
        },
        onError: (err) => toast.error(err.message ?? "Failed to update brand identity"),
      }
    );
  };

  const handleDelete = () => {
    if (!deletingBrandId) return;
    deleteBrand.mutate(
      { id: deletingBrandId },
      {
        onSuccess: () => {
          setDeletingBrandId(null);
          toast.success("Brand identity deleted");
        },
        onError: (err) => toast.error(err.message ?? "Failed to delete brand identity"),
      }
    );
  };

  const handleAddPalette = () => {
    if (!paletteDialogBrandId || !paletteName.trim()) return;
    addPalette.mutate(
      {
        brandIdentityId: paletteDialogBrandId,
        name: paletteName.trim(),
        accentColor: paletteAccent,
        bgColor: paletteBg,
      },
      {
        onSuccess: () => {
          setPaletteDialogBrandId(null);
          setPaletteName("");
          setPaletteAccent("#6366f1");
          setPaletteBg("#ffffff");
          toast.success("Palette added");
        },
        onError: (err) => toast.error(err.message ?? "Failed to add palette"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
        <PageHeaderSkeleton />
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <BrandCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Brand Identities
          </h1>
          <p className="text-sm text-muted-foreground">
            Define and manage brand voices, colors, and styles.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              New Brand
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Brand Identity</DialogTitle>
              <DialogDescription>
                Define a brand identity with a name and tagline. You can add
                color palettes afterwards.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="brand-name">Name</Label>
                <Input
                  id="brand-name"
                  placeholder="e.g. Acme Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brand-tagline">Tagline</Label>
                <Input
                  id="brand-tagline"
                  placeholder="e.g. Building the future"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || createBrand.isPending}
              >
                {createBrand.isPending ? "Creating..." : "Create Brand"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {brands && brands.length > 0 ? (
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {brands.map((brand) => (
            <Card
              key={brand.id}
              className="bg-gradient-to-t from-primary/5 to-card dark:bg-card"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="line-clamp-1 text-base">
                      {brand.name}
                    </CardTitle>
                    {brand.tagline && (
                      <CardDescription className="line-clamp-1">
                        {brand.tagline}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-8 p-0">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingBrand({ id: brand.id, name: brand.name, tagline: brand.tagline ?? "" });
                          setEditName(brand.name);
                          setEditTagline(brand.tagline ?? "");
                          setShowEditDialog(true);
                        }}
                      >
                        <PencilIcon className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => duplicateBrand.mutate({ id: brand.id }, { onError: (err) => toast.error(err.message ?? "Operation failed") })}
                      >
                        <CopyIcon className="mr-2 size-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setDeletingBrandId(brand.id);
                          setDeletingBrandName(brand.name);
                        }}
                      >
                        <TrashIcon className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
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

                {/* Color palette swatches */}
                {brand.palettes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {brand.palettes.map((palette) => (
                      <div key={palette.id} className="group/palette flex items-center gap-1.5">
                        <div
                          className="size-5 rounded-full border"
                          style={{ backgroundColor: palette.accentColor }}
                          title={`${palette.name} -- accent`}
                        />
                        <div
                          className="size-5 rounded-full border"
                          style={{ backgroundColor: palette.bgColor }}
                          title={`${palette.name} -- background`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {palette.name}
                        </span>
                        <button
                          type="button"
                          className="ml-0.5 hidden size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover/palette:inline-flex"
                          onClick={() =>
                            removePalette.mutate(
                              { paletteId: palette.id },
                              { onError: (err) => toast.error(err.message ?? "Failed to remove palette") }
                            )
                          }
                          title="Remove palette"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No color palettes defined yet.
                  </p>
                )}
              </CardContent>
              <CardFooter className="justify-between">
                <Badge variant="outline" className="tabular-nums">
                  {brand.palettes.length} palette{brand.palettes.length !== 1 ? "s" : ""}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPaletteDialogBrandId(brand.id);
                    setPaletteName("");
                    setPaletteAccent("#6366f1");
                    setPaletteBg("#ffffff");
                  }}
                >
                  <PlusIcon className="mr-1 size-3.5" />
                  Add Palette
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={PaletteIcon}
          title="No brand identities yet"
          description="Create a brand identity to define colors, logos, and voice for your content."
          action={
            <Button onClick={() => setOpen(true)}>
              <PlusIcon className="mr-2 size-4" />
              Create Brand
            </Button>
          }
        />
      )}

      {/* Edit Brand Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Brand Identity</DialogTitle>
            <DialogDescription>
              Update the brand name and tagline.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button
              onClick={handleEdit}
              disabled={!editName.trim() || updateBrand.isPending}
            >
              {updateBrand.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Brand Confirmation */}
      <AlertDialog open={!!deletingBrandId} onOpenChange={(open) => { if (!open) setDeletingBrandId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand identity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deletingBrandName}&rdquo; and all its palettes.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Palette Dialog */}
      <Dialog open={!!paletteDialogBrandId} onOpenChange={(open) => { if (!open) setPaletteDialogBrandId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Palette</DialogTitle>
            <DialogDescription>
              Define a color palette with a name, accent color, and background color.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="palette-name">Name</Label>
              <Input
                id="palette-name"
                placeholder="e.g. Primary, Dark Mode"
                value={paletteName}
                onChange={(e) => setPaletteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPalette();
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="palette-accent">Accent Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="palette-accent"
                  value={paletteAccent}
                  onChange={(e) => setPaletteAccent(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                />
                <span className="text-sm text-muted-foreground">{paletteAccent}</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="palette-bg">Background Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="palette-bg"
                  value={paletteBg}
                  onChange={(e) => setPaletteBg(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                />
                <span className="text-sm text-muted-foreground">{paletteBg}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddPalette}
              disabled={!paletteName.trim() || addPalette.isPending}
            >
              {addPalette.isPending ? "Adding..." : "Add Palette"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
