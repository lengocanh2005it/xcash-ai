import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarCollapseFadeProps {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
  /** block for multi-line blocks (logo, user info) */
  block?: boolean;
}

/** Fade + clip sidebar text during collapse — collapses height so icons stay compact. */
export function SidebarCollapseFade({
  collapsed,
  children,
  className,
  block = false,
}: SidebarCollapseFadeProps) {
  return (
    <span
      className={cn(
        'overflow-hidden transition-[opacity,max-width,max-height] duration-200 ease-out',
        block ? 'block min-w-0' : 'inline-block whitespace-nowrap',
        collapsed ? 'max-h-0 max-w-0 opacity-0' : 'max-h-24 max-w-56 opacity-100',
        !block && !collapsed && 'max-h-6',
        className,
      )}
      aria-hidden={collapsed}
    >
      {children}
    </span>
  );
}
