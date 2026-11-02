import { cn } from '@/lib/utils';

/**
 * Cally-IO vector logo mark — an ink square with a cream soundwave,
 * representing AI voice conversations. Pure SVG, light-only.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('size-7', className)}
    >
      <rect width="32" height="32" className="fill-primary" />
      <path
        d="M9.5 13v6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="text-[hsl(40_20%_97%)]"
      />
      <path
        d="M14 9.5v13"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="text-[hsl(40_20%_97%)]"
      />
      <path
        d="M18.5 12v8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="text-[hsl(40_20%_97%)] opacity-70"
      />
      <path
        d="M23 14v4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="text-[hsl(40_20%_97%)] opacity-40"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark className={markClassName} />
      <span className="text-lg font-semibold tracking-tight text-foreground">Cally-IO</span>
    </span>
  );
}
