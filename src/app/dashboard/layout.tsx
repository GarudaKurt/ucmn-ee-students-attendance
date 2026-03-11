"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { ReactNode } from "react";
import AppSidebar from "./(admin)/sidebar/page";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50">
        {/* Sidebar */}
        <AppSidebar />

        {/* Page content — fills remaining width, no max-width cap */}
        <main className="flex flex-1 flex-col min-w-0 p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}