"use client";

import {
  Calendar,
  Home,
  Search,
  User2,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useAuth } from "@/app/context/useAuth";

const AppSidebar = () => {
  const { signOut } = useAuth();

  const items = [
    { title: "Dashboard",           url: "/dashboard/home",        icon: Home },
    { title: "Classroom Schedule",  url: "/dashboard/schedules",   icon: Calendar },
    { title: "Attendance",          url: "/dashboard/information", icon: Search },
    { title: "Enroll Students",     url: "/dashboard/users",       icon: User2 },
    { title: "Logout", icon: LogOut, onClick: signOut },
  ] as const;

  return (
    <Sidebar className="w-60 min-h-screen border-r border-[#2C2C2C]">
      <SidebarContent className="bg-[#2C2C2C]">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {"onClick" in item && item.onClick ? (
                    <button
                      type="button"
                      onClick={item.onClick}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.title}</span>
                    </button>
                  ) : (
                    <SidebarMenuButton asChild>
                      <Link
                        href={"url" in item ? item.url : "#"}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-white hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;