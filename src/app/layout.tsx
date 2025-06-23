import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Toaster } from "@/components/ui/toaster"
import { getLoggedInUser } from '@/lib/auth';
import { usePathname } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Cally-IO',
  description: 'AI Customer Support Agent with Lead Generation',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getLoggedInUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {user ? (
          <SidebarProvider>
            <SidebarNav user={user} />
            <SidebarInset>
              <main className="min-h-screen">
                {children}
              </main>
            </SidebarInset>
            <Toaster />
          </SidebarProvider>
        ) : (
          <main className="min-h-screen">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}
