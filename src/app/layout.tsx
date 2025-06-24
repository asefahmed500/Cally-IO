import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Toaster } from "@/components/ui/toaster"
import { getLoggedInUser } from '@/lib/auth';
import { MobileHeader } from '@/components/layout/mobile-header';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Cally-IO - Your AI Co-pilot',
  description: 'An AI-powered conversational agent with real-time web search.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getLoggedInUser();

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
          {user ? (
            <SidebarProvider>
              <SidebarNav user={user} />
              <SidebarInset>
                  <div className="flex flex-col h-svh">
                      <MobileHeader />
                      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                          {children}
                      </main>
                  </div>
              </SidebarInset>
            </SidebarProvider>
          ) : (
            <main className="min-h-screen">
              {children}
            </main>
          )}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
