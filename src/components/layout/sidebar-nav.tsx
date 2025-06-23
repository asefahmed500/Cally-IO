
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
} from '@/components/ui/sidebar';
import { LayoutDashboard, MessageSquare, Settings, Bot, BookOpen } from 'lucide-react';

const CallyLogo = () => (
    <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
        <div className="p-1.5 bg-primary rounded-lg">
            <Bot className="w-6 h-6 text-primary-foreground" />
        </div>
      <h1 className="text-xl font-bold text-primary group-data-[collapsible=icon]:hidden">Cally-IO</h1>
    </div>
);

export function SidebarNav() {
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
            <Link href="/" passHref>
              <SidebarMenuButton asChild isActive={pathname === '/'} tooltip={{children: 'Dashboard'}}>
                <a><LayoutDashboard /><span>Dashboard</span></a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <Link href="/knowledge-base" passHref>
              <SidebarMenuButton asChild isActive={pathname === '/knowledge-base'} tooltip={{children: 'Knowledge Base'}}>
                <a><BookOpen /><span>Knowledge Base</span></a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/chat" passHref>
              <SidebarMenuButton asChild isActive={pathname === '/chat'} tooltip={{children: 'Chat Interface'}}>
                <a><MessageSquare /><span>Chat Interface</span></a>
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
    </Sidebar>
  );
}
