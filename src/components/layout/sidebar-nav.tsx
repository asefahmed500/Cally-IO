
'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter
} from '@/components/ui/sidebar';
import { LayoutDashboard, Settings, Bot, BookOpen, LogOut, GraduationCap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { logout } from '@/app/auth/actions';
import { Button } from '../ui/button';
import type { Models } from 'appwrite';

const CallyLogo = () => (
    <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
        <div className="p-1.5 bg-primary rounded-lg">
            <Bot className="w-6 h-6 text-primary-foreground" />
        </div>
      <h1 className="text-xl font-bold text-primary group-data-[collapsible=icon]:hidden">Cally-IO</h1>
    </div>
);

function LogoutForm() {
    return (
        <form action={logout}>
            <Button type="submit" variant="ghost" className="w-full justify-start">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
            </Button>
        </form>
    )
}


export function SidebarNav({ user }: { user: Models.User<Models.Preferences> }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="group-data-[collapsible=icon]:p-0">
      <SidebarHeader className="h-16 justify-between p-2">
            <CallyLogo />
            <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard" passHref>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip={{children: 'Dashboard'}}>
                <a><LayoutDashboard /><span>Dashboard</span></a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <Link href="/knowledge-base" passHref>
              <SidebarMenuButton asChild isActive={pathname === '/knowledge-base'} tooltip={{children: 'Subjects'}}>
                <a><BookOpen /><span>Subjects</span></a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/chat" passHref>
              <SidebarMenuButton asChild isActive={pathname === '/chat'} tooltip={{children: 'Learning Studio'}}>
                <a><GraduationCap /><span>Learning Studio</span></a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/settings" passHref>
              <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip={{children: 'Settings'}}>
                <a><Settings /><span>Settings</span></a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
       <SidebarFooter className="p-2 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
        <LogoutForm />
      </SidebarFooter>
    </Sidebar>
  );
}
