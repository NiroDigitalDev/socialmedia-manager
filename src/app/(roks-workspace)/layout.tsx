import { TooltipProvider } from "@/components/ui/tooltip"

export default function RoksWorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TooltipProvider>{children}</TooltipProvider>
}
