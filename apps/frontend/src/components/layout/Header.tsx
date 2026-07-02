import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function Header({ title, description, actions, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-10 border-b border-border bg-background px-4 py-4 text-foreground sm:px-6 lg:top-0',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {actions}
          <ThemeToggle className="hidden lg:inline-flex" />
        </div>
      </div>
    </header>
  );
}
