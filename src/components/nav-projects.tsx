"use client";

import { useState, useRef, useEffect } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusIcon, MoreHorizontalIcon, SearchIcon, FolderIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useProjects, useUpdateProject } from "@/hooks/use-projects";
import { useFavorites, useAddFavorite, useRemoveFavorite } from "@/hooks/use-favorites";
import { useSidebarStore } from "@/stores/use-sidebar-store";
import { SidebarProjectSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 8;

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

function ProjectItem({
  project,
  isActive,
}: {
  project: { id: string; name: string };
  isActive: boolean;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateProject = useUpdateProject();
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const isFavorited = favorites?.some(
    (f) => f.targetType === "project" && f.targetId === project.id
  );

  useEffect(() => {
    setName(project.name);
  }, [project.name]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) {
      updateProject.mutate({ id: project.id, name: trimmed });
    } else {
      setName(project.name);
    }
    setIsRenaming(false);
  };

  if (isRenaming) {
    return (
      <SidebarMenuItem>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <FolderIcon className="size-4 shrink-0 text-sidebar-foreground/70" />
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") {
                setName(project.name);
                setIsRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded-sm bg-sidebar-accent px-1 py-0.5 text-sm outline-none ring-1 ring-sidebar-ring"
          />
        </div>
      </SidebarMenuItem>
    );
  }

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFavorited) {
      removeFavorite.mutate({ targetType: "project", targetId: project.id });
    } else {
      addFavorite.mutate({ targetType: "project", targetId: project.id });
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={project.name}
        isActive={isActive}
      >
        <Link
          href={`/dashboard/projects/${project.id}`}
          onDoubleClick={(e) => {
            e.preventDefault();
            setIsRenaming(true);
          }}
        >
          <FolderIcon className="size-4" />
          <span className="truncate">{project.name}</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuAction
        showOnHover={!isFavorited}
        onClick={toggleFavorite}
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        <StarIcon
          className={cn(
            "size-4",
            isFavorited
              ? "fill-sidebar-foreground text-sidebar-foreground"
              : "text-sidebar-foreground/70"
          )}
        />
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}

export function NavProjects() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const { projectsCollapsed, toggleProjects } = useSidebarStore();

  const [search, setSearch] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const activeProjectId = extractProjectId(pathname);

  const visibleProjects = projects?.slice(0, MAX_VISIBLE) ?? [];
  const hasMore = (projects?.length ?? 0) > MAX_VISIBLE;

  const filteredProjects =
    projects?.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    ) ?? [];

  return (
    <Collapsible open={!projectsCollapsed} onOpenChange={toggleProjects}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            Projects
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
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarProjectSkeleton />
                  </SidebarMenuItem>
                ))
              ) : projects && projects.length > 0 ? (
                <>
                  {visibleProjects.map((project) => (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      isActive={activeProjectId === project.id}
                    />
                  ))}

                  {hasMore && (
                    <SidebarMenuItem>
                      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                        <PopoverTrigger asChild>
                          <SidebarMenuButton tooltip="More projects">
                            <MoreHorizontalIcon className="size-4" />
                            <span>More</span>
                          </SidebarMenuButton>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          align="start"
                          className="w-64 p-0"
                        >
                          <div className="flex items-center gap-2 border-b px-3 py-2">
                            <SearchIcon className="size-4 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Search projects…"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-64 overflow-y-auto p-1">
                            {filteredProjects.length > 0 ? (
                              filteredProjects.map((project) => (
                                <button
                                  key={project.id}
                                  onClick={() => {
                                    setMoreOpen(false);
                                    setSearch("");
                                    router.push(
                                      `/dashboard/projects/${project.id}`
                                    );
                                  }}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    activeProjectId === project.id &&
                                      "bg-sidebar-accent text-sidebar-accent-foreground"
                                  )}
                                >
                                  <FolderIcon className="size-4 shrink-0" />
                                  <span className="truncate">
                                    {project.name}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                                No projects found
                              </p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </SidebarMenuItem>
                  )}
                </>
              ) : (
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
