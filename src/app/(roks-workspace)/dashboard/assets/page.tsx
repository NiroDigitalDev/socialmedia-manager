"use client";

import { ImageIcon, FolderOpenIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetUpload } from "@/components/asset-upload";
import { AssetGrid } from "@/components/asset-grid";
import { EmptyState } from "@/components/empty-state";
import { useAssets, useDeleteAsset } from "@/hooks/use-assets";
import { toast } from "sonner";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

export default function AssetsPage() {
  const {
    data: referenceAssets,
    isLoading: refLoading,
  } = useAssets({ category: "reference" });
  const {
    data: assetAssets,
    isLoading: assetLoading,
  } = useAssets({ category: "asset" });
  const deleteAsset = useDeleteAsset();

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Asset Library</h1>
        <p className="text-sm text-muted-foreground">
          Upload and manage reference materials and production assets.
        </p>
      </div>

      <div className="px-4 lg:px-6">
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
                  <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
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
                  <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
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
