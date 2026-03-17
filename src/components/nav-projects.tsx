"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  PlusIcon,
  ChevronRightIcon,
  LayoutListIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PaletteIcon,
  ImageIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { cn } from "@/lib/utils";

const projectSubPages = [
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

export function NavProjects() {
  const pathname = usePathname();
  const { data: projects } = useProjects();
  const {
    expandedProjectIds,
    projectsCollapsed,
    toggleProject,
    expandProject,
    toggleProjects,
  } = useSidebarStore();

  // Auto-expand the active project when navigating to it
  const activeProjectId = extractProjectId(pathname);
  useEffect(() => {
    if (activeProjectId) {
      expandProject(activeProjectId);
    }
  }, [activeProjectId, expandProject]);

  return (
    <Collapsible open={!projectsCollapsed} onOpenChange={toggleProjects}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            Projects
            <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <SidebarGroupAction asChild>
          <Link href="/dashboard/projects?create=true" title="New Project">
            <PlusIcon />
          </Link>
        </SidebarGroupAction>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects?.map((project) => {
                const isExpanded = expandedProjectIds.has(project.id);
                const isActiveProject = activeProjectId === project.id;
                const projectBase = `/dashboard/projects/${project.id}`;

                return (
                  <Collapsible
                    key={project.id}
                    open={isExpanded}
                    onOpenChange={() => toggleProject(project.id)}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={project.name}
                          className={cn(
                            isActiveProject &&
                              "border-l-2 border-primary pl-[calc(theme(spacing.2)-2px)]"
                          )}
                        >
                          <div
                            className="size-3 shrink-0 rounded-sm"
                            style={{
                              backgroundColor: project.color ?? "#737373",
                            }}
                          />
                          <span className="truncate">{project.name}</span>
                          <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {projectSubPages.map((sub) => {
                            const href = `${projectBase}${sub.segment}`;
                            const isActive =
                              sub.segment === ""
                                ? pathname === projectBase
                                : pathname.startsWith(href);
                            return (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isActive}
                                >
                                  <Link href={href}>
                                    <sub.icon className="size-4" />
                                    <span>{sub.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}

              {(!projects || projects.length === 0) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link
                      href="/dashboard/projects?create=true"
                      className="text-muted-foreground"
                    >
                      <PlusIcon className="size-4" />
                      <span>Create your first project</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
