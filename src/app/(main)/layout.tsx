import { Sidebar } from "@/components/layout/Sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto px-4 pb-6 pt-[4.5rem] md:px-6 md:pt-6">
        {children}
      </main>
    </div>
  );
}
