"use client";

import { use } from "react";
import Link from "next/link";
import {
  MegaphoneIcon,
  PaletteIcon,
  FileTextIcon,
  SparklesIcon,
  PlusIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useProject } from "@/hooks/use-projects";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useBrandIdentities } from "@/hooks/use-brand-identities";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(id);
  const { data: brandIdentities } = useBrandIdentities(id);

  if (projectLoading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project may have been deleted or you don't have access."
      />
    );
  }

  const stats = [
    {
      label: "Campaigns",
      value: project._count.campaigns,
      icon: MegaphoneIcon,
      href: `/dashboard/projects/${id}/campaigns`,
    },
    {
      label: "Brand Identities",
      value: project._count.brandIdentities,
      icon: PaletteIcon,
      href: `/dashboard/projects/${id}/brands`,
    },
    {
      label: "Content Sources",
      value: project._count.contentSources,
      icon: FileTextIcon,
      href: `/dashboard/projects/${id}/content`,
    },
    {
      label: "Generations",
      value: project._count.posts,
      icon: SparklesIcon,
      href: `/dashboard/projects/${id}/generate`,
    },
  ];

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="px-4 lg:px-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/projects/${id}/campaigns`}>
                <PlusIcon className="mr-2 size-4" />
                New Campaign
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/dashboard/projects/${id}/generate`}>
                <SparklesIcon className="mr-2 size-4" />
                Generate
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="bg-gradient-to-t from-primary/5 to-card transition-colors hover:bg-muted/50 dark:bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <stat.icon className="size-5 text-muted-foreground" />
                  <span className="text-2xl font-bold tabular-nums">{stat.value}</span>
                </div>
                <CardDescription>{stat.label}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 px-4 lg:px-6">
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/projects/${id}/content`}>
            <FileTextIcon className="mr-2 size-4" />
            Add Content
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/projects/${id}/brands`}>
            <PaletteIcon className="mr-2 size-4" />
            Brand Identities
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/projects/${id}/assets`}>
            Assets
          </Link>
        </Button>
      </div>

      {/* Recent campaigns */}
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Campaigns</h2>
          {campaigns && campaigns.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/projects/${id}/campaigns`}>
                View all
                <ArrowRightIcon className="ml-1 size-4" />
              </Link>
            </Button>
          )}
        </div>

        {campaignsLoading ? (
          <div className="mt-4 grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="mt-4 grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
            {campaigns.slice(0, 6).map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/projects/${id}/campaigns/${campaign.id}`}
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="line-clamp-1 text-base">{campaign.name}</CardTitle>
                      <Badge variant="outline" className="capitalize">
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
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="tabular-nums">
                        {campaign._count.posts} posts
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
            description="Create a campaign to start generating content for this project."
            action={
              <Button asChild>
                <Link href={`/dashboard/projects/${id}/campaigns`}>
                  <PlusIcon className="mr-2 size-4" />
                  Create Campaign
                </Link>
              </Button>
            }
            className="py-12"
          />
        )}
      </div>
    </div>
  );
}
