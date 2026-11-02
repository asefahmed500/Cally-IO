'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import Link from 'next/link';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
      <Link href="/dashboard">
        <Logo />
      </Link>
      <SidebarTrigger />
    </header>
  );
}
