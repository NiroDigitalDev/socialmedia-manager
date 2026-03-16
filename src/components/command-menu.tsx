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
