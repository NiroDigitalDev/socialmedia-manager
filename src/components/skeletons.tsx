import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// ---------- Project Card Skeleton ----------
// Matches: ProjectCard component (color bar + title + description + badge footer)

export function ProjectCardSkeleton() {
  return (
    <Card className="relative">
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-muted" />
      <CardHeader className="pt-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="size-8 rounded-md" />
        </div>
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardFooter className="gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </CardFooter>
    </Card>
  );
}

// ---------- Campaign Card Skeleton ----------
// Matches: Campaign card (title + status badge + description + count badges)

export function CampaignCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Brand Card Skeleton ----------
// Matches: BrandIdentity card (title + tagline + logo area + palette swatches + footer)

export function BrandCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-3 size-12 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </CardFooter>
    </Card>
  );
}

// ---------- Stat Card Skeleton ----------
// Matches: Project overview stat cards (icon + number + label)

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-7 w-8" />
        </div>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
    </Card>
  );
}

// ---------- Content Source Skeleton ----------
// Matches: ContentSource card (title + idea count badge + description + footer)

export function ContentSourceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardFooter className="justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-8 rounded-md" />
      </CardFooter>
    </Card>
  );
}

// ---------- Content Idea Skeleton ----------
// Matches: ContentIdea card (checkbox + text + badges + action buttons)

export function ContentIdeaSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Skeleton className="mt-0.5 size-4 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-1">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </CardFooter>
    </Card>
  );
}

// ---------- Asset Card Skeleton ----------
// Matches: AssetGrid card (square image thumbnail)

export function AssetCardSkeleton() {
  return <Skeleton className="aspect-square w-full rounded-xl" />;
}

// ---------- Sidebar Project Skeleton ----------
// Matches: NavProjects sidebar item (color dot + project name)

export function SidebarProjectSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Skeleton className="size-3 rounded-sm" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="ml-auto size-4 rounded" />
    </div>
  );
}

// ---------- Page Title Skeleton ----------
// Reusable: page title + subtitle line

export function PageHeaderSkeleton() {
  return (
    <div className="px-4 lg:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
    </div>
  );
}

// ---------- Dashboard Generate CTA Skeleton ----------
// Matches: Quick Generate CTA card on dashboard

export function GenerateCtaSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="size-5 rounded" />
        </div>
      </CardHeader>
    </Card>
  );
}
