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
