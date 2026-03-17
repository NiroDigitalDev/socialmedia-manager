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
  const { data: orgs } = authClient.useListOrganizations()

  // Auto-select the first org if none is active (e.g. after fresh login)
  React.useEffect(() => {
    if (session && !activeOrg && orgs && orgs.length > 0) {
      authClient.organization.setActive({ organizationId: orgs[0].id })
    }
  }, [session, activeOrg, orgs])

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
