"use client";

import { use } from "react";
import Link from "next/link";
import {
  SparklesIcon,
  ArrowLeftIcon,
  FileTextIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useIdeas } from "@/hooks/use-content";

const statusVariant: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  archived: "secondary",
};

const statuses = ["draft", "active", "completed", "archived"] as const;

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id, campaignId } = use(params);
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();
  const { data: ideas } = useIdeas({ projectId: id });

  // Filter ideas assigned to this campaign
  const assignedIdeas = ideas?.filter((i) => i.campaignId === campaignId) ?? [];

  const handleStatusChange = (status: string) => {
    updateCampaign.mutate({
      id: campaignId,
      status: status as (typeof statuses)[number],
    });
  };

  if (isLoading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        description="This campaign may have been deleted or you don't have access."
      />
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      {/* Back link + header */}
      <div className="px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link href={`/dashboard/projects/${id}/campaigns`}>
            <ArrowLeftIcon className="mr-2 size-4" />
            All Campaigns
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {campaign.name}
              </h1>
              <Badge
                variant={statusVariant[campaign.status] ?? "secondary"}
                className={campaign.status === "archived" ? "opacity-60" : ""}
              >
                {campaign.status}
              </Badge>
            </div>
            {campaign.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {campaign.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={campaign.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button asChild>
              <Link href={`/dashboard/projects/${id}/generate`}>
                <SparklesIcon className="mr-2 size-4" />
                Generate Content
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Campaign info cards */}
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle className="capitalize">{campaign.status}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Brand Identity</CardDescription>
            <CardTitle className="text-base">
              {campaign.brandIdentity?.name ?? "None"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Posts</CardDescription>
            <CardTitle className="tabular-nums">
              {campaign._count.posts}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Ideas</CardDescription>
            <CardTitle className="tabular-nums">
              {campaign._count.contentIdeas}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Assigned ideas section */}
      <div className="px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Assigned Ideas</h2>
        {assignedIdeas.length > 0 ? (
          <div className="mt-4 grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
            {assignedIdeas.map((idea) => (
              <Card key={idea.id}>
                <CardHeader>
                  <CardDescription className="line-clamp-3">
                    {idea.ideaText}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{idea.contentType}</Badge>
                    <Badge variant="outline">{idea.format}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileTextIcon}
            title="No ideas assigned"
            description="Ideas will appear here once they are assigned to this campaign."
            className="py-12"
          />
        )}
      </div>

      {/* Generated content section */}
      <div className="px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Generated Content</h2>
        <EmptyState
          icon={SparklesIcon}
          title="No generated content yet"
          description="Use the Generate Content button to start creating posts for this campaign."
          action={
            <Button asChild>
              <Link href={`/dashboard/projects/${id}/generate`}>
                <SparklesIcon className="mr-2 size-4" />
                Generate Content
              </Link>
            </Button>
          }
          className="py-12"
        />
      </div>
    </div>
  );
}
