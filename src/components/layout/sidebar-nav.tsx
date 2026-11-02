'use client'
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarFooter,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Users,
  BookOpen,
  ListTodo,
  ChevronsUpDown,
  Plus,
  Building2,
  Check,
  Radio,
  PhoneCall,
  PhoneIncoming,
  Megaphone,
  Workflow,
  BarChart3,
  CreditCard,
  ScrollText,
  ShieldCheck,
  Bot,
  Target,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { logout } from '@/app/auth/actions';
import { Button } from '../ui/button';
import type { SessionUser } from '@/lib/auth';
import type { MemberRole } from '@prisma/client';
import { can, type Capability } from '@/lib/permissions';
import { switchWorkspaceAction } from '@/app/onboarding/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Logo } from '../logo';

export type WorkspaceOption = { id: string; name: string; isOwner: boolean };

type NavItemDef = { title: string; icon: React.ElementType; href: string; capability?: Capability };
type NavGroupDef = { label: string; items: NavItemDef[] };

const NAV_GROUPS: NavGroupDef[] = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { title: 'Live Operations', icon: Radio, href: '/live', capability: 'liveops.monitor' },
    ],
  },
  {
    label: 'Communications',
    items: [
      { title: 'Call History', icon: PhoneCall, href: '/calls', capability: 'calls.view' },
      { title: 'Dialer', icon: PhoneIncoming, href: '/dialer', capability: 'calls.initiate' },
    ],
  },
  {
    label: 'AI Workforce',
    items: [
      { title: 'AI Agents', icon: Bot, href: '/agents', capability: 'agents.view' },
      { title: 'Knowledge Base', icon: BookOpen, href: '/knowledge', capability: 'knowledge.view' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { title: 'Contacts', icon: Users, href: '/contacts', capability: 'contacts.view' },
      { title: 'Leads', icon: Target, href: '/leads', capability: 'leads.view' },
      { title: 'Tasks', icon: ListTodo, href: '/tasks', capability: 'tasks.view' },
      { title: 'Campaigns', icon: Megaphone, href: '/campaigns', capability: 'campaigns.view' },
      { title: 'Workflows', icon: Workflow, href: '/workflows', capability: 'workflows.view' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { title: 'Analytics', icon: BarChart3, href: '/analytics', capability: 'analytics.view' },
      { title: 'Billing & Usage', icon: CreditCard, href: '/billing', capability: 'analytics.view' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { title: 'Settings', icon: Settings, href: '/settings', capability: 'members.manage' },
    ],
  },
];

function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceOption[];
  activeWorkspaceId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  if (!active) return null;

  const handleSwitch = (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) return;
    startTransition(async () => {
      await switchWorkspaceAction(workspaceId);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2 border bg-background p-2 text-left outline-none ring-ring transition-colors hover:bg-accent focus-visible:ring-2 disabled:opacity-60"
          disabled={isPending}
        >
          <span className="flex size-7 shrink-0 items-center justify-center bg-secondary">
            <Building2 className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{active.name}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} onSelect={() => handleSwitch(workspace.id)}>
            <Building2 />
            <span className="flex-1 truncate">{workspace.name}</span>
            {workspace.id === activeWorkspaceId && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus /> Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NavItem = ({
  href,
  a_pathname,
  tooltipText,
  children,
}: {
  href: string;
  a_pathname: string;
  tooltipText: string;
  children: React.ReactNode;
}) => {
  const { state, isMobile } = useSidebar();
  const isActive = a_pathname === href || (href !== '/dashboard' && a_pathname.startsWith(href));

  const buttonContent = (
    <SidebarMenuButton asChild isActive={isActive}>
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
};

export function SidebarNav({
  user,
  workspaces,
  activeWorkspaceId,
  role,
}: {
  user: SessionUser;
  workspaces: WorkspaceOption[];
  activeWorkspaceId?: string;
  role: MemberRole;
}) {
  const pathname = usePathname();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.capability || can(role, item.capability)),
  })).filter((group) => group.items.length > 0);

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar collapsible="icon" className="group-data-[collapsible=icon]:p-0">
        <SidebarHeader className="gap-2 p-2">
          <div className="flex h-10 items-center justify-between">
            <Link href="/dashboard" className="group-data-[collapsible=icon]:hidden">
              <Logo className="px-1" />
            </Link>
            <SidebarTrigger />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          {visibleGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <NavItem href={item.href} a_pathname={pathname} tooltipText={item.title}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavItem>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="p-2 gap-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-3 p-2 bg-sidebar-accent">
            <Avatar className="size-8">
              <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <form action={logout} className="flex-1">
              <Button type="submit" variant="ghost" className="w-full justify-start p-2 text-left">
                <LogOut className="size-4" />
                <span>Logout</span>
              </Button>
            </form>
          </div>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
