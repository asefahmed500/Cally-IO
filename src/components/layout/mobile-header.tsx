'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold">
        <Briefcase className="h-6 w-6 text-primary" />
        <span>CorpKit</span>
      </Link>
      <SidebarTrigger />
    </header>
  );
}
