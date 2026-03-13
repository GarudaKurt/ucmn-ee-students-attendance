"use client";

import { Calendar, Home, Search, User2, LogOut } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/../../firebase/configFirebase";

const navItems = [
  { title: "Classroom Schedule", url: "/dashboard/schedules",   icon: Calendar },
  { title: "Attendance",         url: "/dashboard/information", icon: Search },
  { title: "Enroll Students",    url: "/dashboard/users",       icon: User2 },
];

const AppSidebar = () => {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/signin");
  };

  return (
    <Sidebar className="w-60 min-h-screen border-r border-[#2C2C2C]">
      <SidebarContent className="bg-[#2C2C2C]">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      prefetch={true}
                      href={item.url}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-white hover:bg-gray-100 hover:text-black rounded-md transition-colors"
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Logout */}
              <SidebarMenuItem>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;