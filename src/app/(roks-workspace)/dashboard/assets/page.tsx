"use client";

import { ImageIcon, FolderOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetUpload } from "@/components/asset-upload";
import { AssetGrid } from "@/components/asset-grid";
import { EmptyState } from "@/components/empty-state";
import { AssetCardSkeleton } from "@/components/skeletons";
import { useAssets, useDeleteAsset } from "@/hooks/use-assets";
import { toast } from "sonner";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

export default function AssetsPage() {
  const {
    data: referenceAssets,
    isLoading: refLoading,
    isError: refError,
  } = useAssets({ category: "reference" });
  const {
    data: assetAssets,
    isLoading: assetLoading,
    isError: assetError,
  } = useAssets({ category: "asset" });
  const deleteAsset = useDeleteAsset();

  if (refError || assetError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        {!R2_PUBLIC_URL && (
          <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600">
            R2 public URL not configured. Asset images won&apos;t display. Set NEXT_PUBLIC_R2_PUBLIC_URL in your environment.
          </div>
        )}
        <Tabs defaultValue="reference" className="w-full">
          <TabsList>
            <TabsTrigger value="reference">Reference &amp; Inspiration</TabsTrigger>
            <TabsTrigger value="asset">Assets</TabsTrigger>
          </TabsList>

          <TabsContent value="reference" className="mt-4 space-y-6">
            <AssetUpload category="reference" />
            {refLoading ? (
              <div className="grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <AssetCardSkeleton key={i} />
                ))}
              </div>
            ) : referenceAssets && referenceAssets.length > 0 ? (
              <AssetGrid
                assets={referenceAssets}
                publicUrlBase={R2_PUBLIC_URL}
                onDelete={(id) => deleteAsset.mutate({ id }, { onError: (err) => toast.error(err.message ?? "Operation failed") })}
                isDeleting={deleteAsset.isPending}
              />
            ) : (
              <EmptyState
                icon={ImageIcon}
                title="No reference materials yet"
                description="Upload reference images, mood boards, or inspiration files to get started."
                className="py-12"
              />
            )}
          </TabsContent>

          <TabsContent value="asset" className="mt-4 space-y-6">
            <AssetUpload category="asset" />
            {assetLoading ? (
              <div className="grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <AssetCardSkeleton key={i} />
                ))}
              </div>
            ) : assetAssets && assetAssets.length > 0 ? (
              <AssetGrid
                assets={assetAssets}
                publicUrlBase={R2_PUBLIC_URL}
                onDelete={(id) => deleteAsset.mutate({ id }, { onError: (err) => toast.error(err.message ?? "Operation failed") })}
                isDeleting={deleteAsset.isPending}
              />
            ) : (
              <EmptyState
                icon={FolderOpenIcon}
                title="No assets yet"
                description="Upload logos, icons, brand assets, and other production files."
                className="py-12"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
