import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Social Media Manager",
  description: "AI-powered social media post generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto px-4 pb-6 pt-[4.5rem] md:px-6 md:pt-6">
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
