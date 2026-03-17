"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutListIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PaletteIcon,
  ImageIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProject } from "@/hooks/use-projects";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const subPages = [
  { title: "Overview", segment: "", icon: LayoutListIcon },
  { title: "Content", segment: "/content", icon: FileTextIcon },
  { title: "Campaigns", segment: "/campaigns", icon: FlaskConicalIcon },
  { title: "Brand Identities", segment: "/brands", icon: PaletteIcon },
  { title: "Assets", segment: "/assets", icon: ImageIcon },
  { title: "Generate", segment: "/generate", icon: SparklesIcon },
];

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

export function NavActiveProject() {
  const pathname = usePathname();
  const router = useRouter();
  const projectId = extractProjectId(pathname);
  const { data: project, isLoading } = useProject(projectId ?? undefined);

  // Don't render if we're not on a project page
  if (!projectId) return null;

  const projectBase = `/dashboard/projects/${projectId}`;

  const handleClose = () => {
    router.push("/dashboard");
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <>
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project?.color ?? "#737373" }}
            />
            <span className="truncate">{project?.name ?? "Project"}</span>
          </>
        )}
        <button
          onClick={handleClose}
          className={cn(
            "ml-auto rounded-sm p-0.5 opacity-0 transition-opacity",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "group-hover/sidebar-group:opacity-100"
          )}
          aria-label="Close active project"
        >
          <XIcon className="size-3.5" />
        </button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {subPages.map((sub) => {
            const href = `${projectBase}${sub.segment}`;
            const isActive =
              sub.segment === ""
                ? pathname === projectBase
                : pathname.startsWith(href);

            return (
              <SidebarMenuItem key={sub.title}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={sub.title}>
                  <Link href={href}>
                    <sub.icon className="size-4" />
                    <span>{sub.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
