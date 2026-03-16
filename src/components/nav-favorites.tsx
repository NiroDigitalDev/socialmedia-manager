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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StarIcon, FolderIcon, FlaskConicalIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useFavorites } from "@/hooks/use-favorites";
import { useSidebarStore } from "@/stores/use-sidebar-store";

const iconMap: Record<string, React.ElementType> = {
  project: FolderIcon,
  campaign: FlaskConicalIcon,
  route: StarIcon,
};

export function NavFavorites() {
  const { data: favorites } = useFavorites();
  const { favoritesCollapsed, toggleFavorites } = useSidebarStore();

  if (!favorites || favorites.length === 0) {
    return null;
  }

  return (
    <Collapsible open={!favoritesCollapsed} onOpenChange={toggleFavorites}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            Favorites
            <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {favorites.map((fav) => {
                const Icon = iconMap[fav.targetType] ?? StarIcon;
                const href =
                  fav.targetType === "route"
                    ? fav.targetId
                    : fav.targetType === "project"
                      ? `/dashboard/projects/${fav.targetId}`
                      : "#";
                return (
                  <SidebarMenuItem key={fav.id}>
                    <SidebarMenuButton asChild tooltip={fav.targetId}>
                      <Link href={href}>
                        <Icon className="size-4" />
                        <span className="truncate">{fav.targetId}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
