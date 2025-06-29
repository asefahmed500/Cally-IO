
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
  SidebarFooter,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Settings, LogOut, BotMessageSquare, Users, BookOpen } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { logout } from '@/app/auth/actions';
import { Button } from '../ui/button';
import type { Models } from 'appwrite';
import { ThemeToggle } from './theme-toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

const Logo = () => (
    <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
        <div className="p-1.5 bg-primary rounded-lg">
            <BotMessageSquare className="w-6 h-6 text-primary-foreground" />
        </div>
      <h1 className="text-xl font-bold text-primary group-data-[collapsible=icon]:hidden">Cally-IO</h1>
    </div>
);

const NavItem = ({ href, a_pathname, tooltipText, children }: { href: string, a_pathname: string, tooltipText: string, children: React.ReactNode }) => {
    const { state, isMobile } = useSidebar();
    const isActive = a_pathname === href;

    const buttonContent = (
      <SidebarMenuButton asChild isActive={isActive} >
        <Link href={href}>
          {children}
        </Link>
      </SidebarMenuButton>
    );

    if (state !== 'collapsed' || isMobile) {
        return buttonContent;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {buttonContent}
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
                {tooltipText}
            </TooltipContent>
        </Tooltip>
    );
}


export function SidebarNav({ user }: { user: Models.User<Models.Preferences> }) {
  const pathname = usePathname();
  const isAdmin = user.labels.includes('admin');

  return (
    <TooltipProvider delayDuration={0}>
        <Sidebar collapsible="icon" className="group-data-[collapsible=icon]:p-0">
        <SidebarHeader className="h-16 justify-between p-2">
                <Logo />
                <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
            <SidebarMenu>
            <SidebarMenuItem>
                <NavItem href="/dashboard" a_pathname={pathname} tooltipText="Dashboard">
                    <LayoutDashboard /><span>Dashboard</span>
                </NavItem>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <NavItem href="/knowledge" a_pathname={pathname} tooltipText="Knowledge">
                    <BookOpen /><span>Knowledge</span>
                </NavItem>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <NavItem href="/leads" a_pathname={pathname} tooltipText="Leads">
                    <Users /><span>Leads</span>
                </NavItem>
            </SidebarMenuItem>
            {isAdmin && (
                <SidebarMenuItem>
                    <NavItem href="/settings" a_pathname={pathname} tooltipText="Settings">
                        <Settings /><span>Settings</span>
                    </NavItem>
                </SidebarMenuItem>
            )}
            </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 space-y-2 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent">
            <Avatar className="h-8 w-8">
                <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col truncate">
                <span className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
            </div>
            <div className="flex items-center justify-between">
                <form action={logout} className="flex-1">
                    <Button type="submit" variant="ghost" className="w-full justify-start p-2 text-left">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                    </Button>
                </form>
                <ThemeToggle />
            </div>
        </SidebarFooter>
        </Sidebar>
    </TooltipProvider>
  );
}
