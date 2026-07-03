import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LogoMark } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { DesktopSidebar, MobileSidebar } from './Sidebar';

export function TenantLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-svh items-stretch bg-muted">
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />
      <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background px-4 py-3 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Mở menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <LogoMark size={28} className="rounded-lg" />
          <p className="truncate font-semibold text-primary">X-Cash AI</p>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
