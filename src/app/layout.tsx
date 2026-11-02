
import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Toaster } from "@/components/ui/toaster"
import { getLoggedInUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { WORKSPACE_COOKIE } from '@/lib/tenant';
import { MobileHeader } from '@/components/layout/mobile-header';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Cally-IO — The AI Workforce for Every Customer Conversation',
  description: 'Multi-tenant AI contact center SaaS: AI voice agents, calling, CRM, campaigns, and automation.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getLoggedInUser();

  let workspaces: { id: string; name: string; isOwner: boolean }[] = [];
  let activeWorkspaceId: string | undefined;
  let activeRole: import('@prisma/client').MemberRole | undefined;

  if (user) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.$id, workspace: { deletedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: {
        workspaceId: true,
        isOwner: true,
        role: true,
        workspace: { select: { name: true } },
      },
    });

    if (memberships.length === 0) {
      redirect('/onboarding');
    }

    workspaces = memberships.map((m) => ({
      id: m.workspaceId,
      name: m.workspace.name,
      isOwner: m.isOwner,
    }));

    const cookieWorkspaceId = cookies().get(WORKSPACE_COOKIE)?.value;
    const active =
      memberships.find((m) => m.workspaceId === cookieWorkspaceId) ?? memberships[0];
    activeWorkspaceId = active.workspaceId;
    activeRole = active.role;
  }

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
          {user ? (
            <div className="flex min-h-screen">
              <SidebarProvider>
                <SidebarNav
                  user={user}
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  role={activeRole!}
                />
                <SidebarInset>
                    <MobileHeader />
                    <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                        {children}
                    </main>
                </SidebarInset>
              </SidebarProvider>
            </div>
          ) : (
            <main className="min-h-screen">
              {children}
            </main>
          )}
          <Toaster />
      </body>
    </html>
  );
}
