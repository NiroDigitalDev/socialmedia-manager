# Sidebar Active Project Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Add an Active Project section to the sidebar, auto-expand projects on navigation, add Gallery + Styles to global nav, and create stub pages.
**Depends on:** None (uses existing `useProject` hook and sidebar store)
**Architecture:** A new `NavActiveProject` component detects the active project from the URL pathname, renders a dedicated sidebar section with direct sub-page links, and provides quick context without requiring the Projects section to be expanded. The global nav gains Gallery and Styles entries. Projects auto-expand when navigated to. Stub pages ensure routes resolve.
**Tech Stack:** shadcn/ui sidebar primitives, Zustand (sidebar store), Next.js `usePathname`, TanStack Query, Skeleton components

---

## Task 1: Add `expandProject` Action to Sidebar Store

**File:** `src/stores/use-sidebar-store.ts` — replace entire file

```typescript
import { create } from "zustand";

interface SidebarState {
  expandedProjectIds: Set<string>;
  favoritesCollapsed: boolean;
  projectsCollapsed: boolean;
  toggleProject: (projectId: string) => void;
  expandProject: (projectId: string) => void;
  toggleFavorites: () => void;
  toggleProjects: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  expandedProjectIds: new Set(),
  favoritesCollapsed: false,
  projectsCollapsed: false,

  toggleProject: (projectId) =>
    set((state) => {
      const next = new Set(state.expandedProjectIds);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return { expandedProjectIds: next };
    }),

  expandProject: (projectId) =>
    set((state) => {
      if (state.expandedProjectIds.has(projectId)) return state;
      const next = new Set(state.expandedProjectIds);
      next.add(projectId);
      return { expandedProjectIds: next, projectsCollapsed: false };
    }),

  toggleFavorites: () =>
    set((state) => ({ favoritesCollapsed: !state.favoritesCollapsed })),

  toggleProjects: () =>
    set((state) => ({ projectsCollapsed: !state.projectsCollapsed })),
}));
```

---

## Task 2: Fix `useProject` Hook to Support Conditional Fetching

**File:** `src/hooks/use-projects.ts` — replace the `useProject` function only

Find this exact block:

```typescript
export function useProject(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.project.get.queryOptions({ id }));
}
```

Replace with:

```typescript
export function useProject(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.project.get.queryOptions({ id: id! }),
    enabled: !!id,
  });
}
```

---

## Task 3: Create `NavActiveProject` Component

**File:** `src/components/nav-active-project.tsx` (new file)

```typescript
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
```

---

## Task 4: Add Gallery + Styles to Global Nav

**File:** `src/components/nav-global.tsx` — replace entire file

```typescript
"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  SparklesIcon,
  LibraryIcon,
  GalleryHorizontalEndIcon,
  PaintbrushIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Generate", url: "/dashboard/generate", icon: SparklesIcon },
  { title: "Gallery", url: "/dashboard/gallery", icon: GalleryHorizontalEndIcon },
  { title: "Styles", url: "/dashboard/styles", icon: PaintbrushIcon },
  { title: "Asset Library", url: "/dashboard/assets", icon: LibraryIcon },
];

export function NavGlobal() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={
                  item.url === "/dashboard"
                    ? pathname === item.url
                    : pathname.startsWith(item.url)
                }
                tooltip={item.title}
              >
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

---

## Task 5: Auto-Expand Active Project in NavProjects

**File:** `src/components/nav-projects.tsx` — replace entire file

```typescript
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
```

---

## Task 6: Insert NavActiveProject into AppSidebar

**File:** `src/components/app-sidebar.tsx` — replace entire file

```typescript
"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CommandIcon, Settings2Icon } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { NavGlobal } from "@/components/nav-global"
import { NavActiveProject } from "@/components/nav-active-project"
import { NavFavorites } from "@/components/nav-favorites"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { CommandMenu } from "@/components/command-menu"

// NavSecondary expects icon as React.ReactNode (rendered JSX), not React.ElementType
const secondaryItems = [
  { title: "Settings", url: "/dashboard/settings", icon: <Settings2Icon /> },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()

  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? "",
      }
    : { name: "", email: "", image: "" }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <CommandIcon className="size-5" />
                <span className="text-base font-semibold">
                  {activeOrg?.name ?? "Dashboard"}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGlobal />
        <NavActiveProject />
        <NavFavorites />
        <NavProjects />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <CommandMenu />
    </Sidebar>
  )
}
```

---

## Task 7: Add Gallery + Styles to Command Menu

**File:** `src/components/command-menu.tsx` — replace entire file

```typescript
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  LayoutDashboardIcon,
  SparklesIcon,
  LibraryIcon,
  GalleryHorizontalEndIcon,
  PaintbrushIcon,
  FolderKanbanIcon,
  Settings2Icon,
  LogOutIcon,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const navigate = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  const handleLogout = async () => {
    setOpen(false)
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/dashboard")}>
            <LayoutDashboardIcon />
            <span>Dashboard</span>
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/generate")}>
            <SparklesIcon />
            <span>Generate</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/gallery")}>
            <GalleryHorizontalEndIcon />
            <span>Gallery</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/styles")}>
            <PaintbrushIcon />
            <span>Styles</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/assets")}>
            <LibraryIcon />
            <span>Asset Library</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/projects")}>
            <FolderKanbanIcon />
            <span>Projects</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => navigate("/dashboard/settings")}>
            <Settings2Icon />
            <span>Settings</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={handleLogout}>
            <LogOutIcon />
            <span>Log out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

---

## Task 8: Add Breadcrumb Labels for Gallery + Styles

**File:** `src/components/site-header.tsx` — update the `SEGMENT_LABELS` object

Find:

```typescript
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  generate: "Generate",
  assets: "Asset Library",
  projects: "Projects",
  settings: "Settings",
  content: "Content",
  campaigns: "Campaigns",
  "brand-identities": "Brand Identities",
  brands: "Brand Identities",
  favorites: "Favorites",
}
```

Replace with:

```typescript
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  generate: "Generate",
  gallery: "Gallery",
  styles: "Styles",
  assets: "Asset Library",
  projects: "Projects",
  settings: "Settings",
  content: "Content",
  campaigns: "Campaigns",
  "brand-identities": "Brand Identities",
  brands: "Brand Identities",
  favorites: "Favorites",
}
```

---

## Task 9: Create Stub Gallery Page

**File:** `src/app/(roks-workspace)/dashboard/gallery/page.tsx` (new file)

First, ensure the directory exists:

```bash
mkdir -p src/app/\(roks-workspace\)/dashboard/gallery
```

```typescript
export default function GalleryPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gallery</h1>
      </div>
      <p className="text-muted-foreground">
        Browse all your generated content in one place. Coming soon.
      </p>
    </div>
  );
}
```

---

## Task 10: Create Stub Styles Page

**File:** `src/app/(roks-workspace)/dashboard/styles/page.tsx` (new file)

First, ensure the directory exists:

```bash
mkdir -p src/app/\(roks-workspace\)/dashboard/styles
```

```typescript
export default function StylesPage() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Styles</h1>
      </div>
      <p className="text-muted-foreground">
        Manage visual styles for your generated content. Coming soon.
      </p>
    </div>
  );
}
```

---

## Task 11: Type-check

Run from project root:

```bash
bunx tsc --noEmit
```

Pre-existing errors in `(main)` route group can be ignored. Only verify zero new errors from files touched in this plan:
- `src/stores/use-sidebar-store.ts`
- `src/hooks/use-projects.ts`
- `src/components/nav-active-project.tsx`
- `src/components/nav-global.tsx`
- `src/components/nav-projects.tsx`
- `src/components/app-sidebar.tsx`
- `src/components/command-menu.tsx`
- `src/components/site-header.tsx`
- `src/app/(roks-workspace)/dashboard/gallery/page.tsx`
- `src/app/(roks-workspace)/dashboard/styles/page.tsx`

---

## Task 12: Commit

```bash
git add \
  src/stores/use-sidebar-store.ts \
  src/hooks/use-projects.ts \
  src/components/nav-active-project.tsx \
  src/components/nav-global.tsx \
  src/components/nav-projects.tsx \
  src/components/app-sidebar.tsx \
  src/components/command-menu.tsx \
  src/components/site-header.tsx \
  "src/app/(roks-workspace)/dashboard/gallery/page.tsx" \
  "src/app/(roks-workspace)/dashboard/styles/page.tsx"
git commit -m "feat: add active project sidebar section, gallery + styles nav, auto-expand projects"
```

---

## Key Implementation Notes

1. **NavActiveProject renders conditionally.** It returns `null` when the pathname does not match `/dashboard/projects/[id]`. When present, it shows between NavGlobal and NavFavorites for maximum visibility.

2. **Project name loading state.** Uses shadcn `Skeleton` component (`h-4 w-24`) while the project data loads, preventing layout shift.

3. **Close button behavior.** The X button navigates to `/dashboard` (exits the project context). It uses `opacity-0 group-hover/sidebar-group:opacity-100` for progressive disclosure.

4. **Sub-pages array is shared.** Both `NavActiveProject` and `NavProjects` use the same 6 sub-pages (Overview, Content, Campaigns, Brand Identities, Assets, Generate). `NavActiveProject` defines its own copy to avoid circular imports.

5. **Auto-expand via `useEffect`.** `NavProjects` watches `pathname` changes, extracts the projectId, and calls `expandProject()` (not `toggleProject()`). The `expandProject` action is idempotent — it only adds to the set if not already present, and also ensures `projectsCollapsed` is `false`.

6. **Active project visual distinction.** In `NavProjects`, the active project's `SidebarMenuButton` gets a `border-l-2 border-primary` left border accent using `cn()`.

7. **Gallery icon:** `GalleryHorizontalEndIcon` from lucide-react. **Styles icon:** `PaintbrushIcon` from lucide-react.

8. **`isActive` logic for nav-global.** Dashboard uses exact match (`pathname === item.url`) to avoid false positives on sub-routes. All other items use `pathname.startsWith(item.url)`.

9. **Stub pages use the `@container/main` pattern** consistent with the `(roks-workspace)` layout. They are server components (no `"use client"` needed) and follow the existing page structure.
