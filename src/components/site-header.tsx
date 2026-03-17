"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

/** Human-readable labels for known route segments. */
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

/** Check if a string looks like a cuid / uuid (dynamic segment). */
function isDynamicSegment(segment: string): boolean {
  // cuid2 (starts with c + 24 chars), cuid (starts with c + 24+ chars), or uuid
  return (
    /^c[a-z0-9]{20,}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment
    )
  )
}

interface BreadcrumbEntry {
  label: string
  href: string
  isLast: boolean
}

function buildBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  // Strip leading /dashboard — it is always the root
  const withoutDashboard = pathname.replace(/^\/dashboard\/?/, "")
  const segments = withoutDashboard ? withoutDashboard.split("/") : []

  // The root breadcrumb
  const crumbs: BreadcrumbEntry[] = [
    { label: "Dashboard", href: "/dashboard", isLast: segments.length === 0 },
  ]

  let currentPath = "/dashboard"
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    currentPath += `/${seg}`
    const isLast = i === segments.length - 1

    if (isDynamicSegment(seg)) {
      // For dynamic IDs, show "Project" as placeholder
      crumbs.push({ label: "Project", href: currentPath, isLast })
    } else {
      crumbs.push({
        label: SEGMENT_LABELS[seg] ?? seg,
        href: currentPath,
        isLast,
      })
    }
  }

  return crumbs
}

export function SiteHeader() {
  const pathname = usePathname()
  const crumbs = buildBreadcrumbs(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, idx) => (
              <Fragment key={crumb.href}>
                {idx > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}
