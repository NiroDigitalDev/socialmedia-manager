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
  ListIcon,
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  Settings2Icon,
  CircleHelpIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
  LogOutIcon,
  UserIcon,
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
          <CommandItem onSelect={() => navigate("#")}>
            <ListIcon />
            <span>Lifecycle</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("#")}>
            <ChartBarIcon />
            <span>Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("#")}>
            <FolderIcon />
            <span>Projects</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("#")}>
            <UsersIcon />
            <span>Team</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Documents">
          <CommandItem onSelect={() => navigate("#")}>
            <DatabaseIcon />
            <span>Data Library</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("#")}>
            <FileChartColumnIcon />
            <span>Reports</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("#")}>
            <FileIcon />
            <span>Word Assistant</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => navigate("/dashboard/settings")}>
            <UserIcon />
            <span>Profile</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/settings")}>
            <Settings2Icon />
            <span>Settings</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate("#")}>
            <CircleHelpIcon />
            <span>Get Help</span>
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
