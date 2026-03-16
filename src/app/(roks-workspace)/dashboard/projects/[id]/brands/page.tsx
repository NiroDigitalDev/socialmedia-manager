"use client";

import { use, useState } from "react";
import {
  PaletteIcon,
  PlusIcon,
  MoreHorizontalIcon,
  CopyIcon,
  PencilIcon,
  TrashIcon,
  ImageIcon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import {
  useBrandIdentities,
  useCreateBrandIdentity,
  useDuplicateBrandIdentity,
  useDeleteBrandIdentity,
} from "@/hooks/use-brand-identities";

export default function BrandIdentitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: brands, isLoading } = useBrandIdentities(id);
  const createBrand = useCreateBrandIdentity();
  const duplicateBrand = useDuplicateBrandIdentity();
  const deleteBrand = useDeleteBrandIdentity();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");

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
      }
    );
  };

  if (isLoading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
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
                      <DropdownMenuItem disabled>
                        <PencilIcon className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => duplicateBrand.mutate({ id: brand.id })}
                      >
                        <CopyIcon className="mr-2 size-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteBrand.mutate({ id: brand.id })}
                      >
                        <TrashIcon className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {/* Logo placeholder */}
                <div className="mb-3 flex size-12 items-center justify-center rounded-lg bg-muted">
                  <ImageIcon className="size-6 text-muted-foreground" />
                </div>

                {/* Color palette swatches */}
                {brand.palettes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {brand.palettes.map((palette) => (
                      <div key={palette.id} className="flex items-center gap-1.5">
                        <div
                          className="size-5 rounded-full border"
                          style={{ backgroundColor: palette.accentColor }}
                          title={`${palette.name} — accent`}
                        />
                        <div
                          className="size-5 rounded-full border"
                          style={{ backgroundColor: palette.bgColor }}
                          title={`${palette.name} — background`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {palette.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No color palettes defined yet.
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Badge variant="outline" className="tabular-nums">
                  {brand.palettes.length} palette{brand.palettes.length !== 1 ? "s" : ""}
                </Badge>
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
    </div>
  );
}
