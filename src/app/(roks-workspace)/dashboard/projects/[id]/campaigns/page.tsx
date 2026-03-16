"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MegaphoneIcon, PlusIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { useCampaigns, useCreateCampaign } from "@/hooks/use-campaigns";
import { useBrandIdentities } from "@/hooks/use-brand-identities";

const statusVariant: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  archived: "secondary",
};

export default function CampaignsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { data: campaigns, isLoading } = useCampaigns(id);
  const { data: brands } = useBrandIdentities(id);
  const createCampaign = useCreateCampaign();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brandIdentityId, setBrandIdentityId] = useState<string>("");

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setOpen(true);
    }
  }, [searchParams]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createCampaign.mutate(
      {
        projectId: id,
        name: name.trim(),
        description: description.trim() || undefined,
        brandIdentityId: brandIdentityId || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
          setBrandIdentityId("");
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
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            View and manage campaigns for this project.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>
                A campaign groups generated content around a theme or goal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="campaign-name">Name</Label>
                <Input
                  id="campaign-name"
                  placeholder="e.g. Product Launch Q3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-description">Description</Label>
                <Textarea
                  id="campaign-description"
                  placeholder="What is this campaign about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-brand">Brand Identity (optional)</Label>
                <Select
                  value={brandIdentityId}
                  onValueChange={setBrandIdentityId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a brand identity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {brands?.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || createCampaign.isPending}
              >
                {createCampaign.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/dashboard/projects/${id}/campaigns/${campaign.id}`}
            >
              <Card className="bg-gradient-to-t from-primary/5 to-card transition-colors hover:bg-muted/50 dark:bg-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-1 text-base">
                      {campaign.name}
                    </CardTitle>
                    <Badge
                      variant={statusVariant[campaign.status] ?? "secondary"}
                      className={
                        campaign.status === "archived" ? "opacity-60" : ""
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <CardDescription className="line-clamp-2">
                      {campaign.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="tabular-nums">
                      {campaign._count.posts} posts
                    </Badge>
                    <Badge variant="outline" className="tabular-nums">
                      {campaign._count.contentIdeas} ideas
                    </Badge>
                    {campaign.brandIdentity && (
                      <Badge variant="secondary">
                        {campaign.brandIdentity.name}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MegaphoneIcon}
          title="No campaigns yet"
          description="Create a campaign to start organizing and generating content."
          action={
            <Button onClick={() => setOpen(true)}>
              <PlusIcon className="mr-2 size-4" />
              Create Campaign
            </Button>
          }
        />
      )}
    </div>
  );
}
