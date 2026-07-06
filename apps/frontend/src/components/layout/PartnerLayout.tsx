import {
  Building2,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Receipt,
  ScrollText,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils';

const partnerNavItems = [
  { to: '/partner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/partner/tenants', label: 'Doanh nghiệp', icon: Building2 },
  { to: '/partner/payments', label: 'Lịch sử thanh toán', icon: Receipt },
  { to: '/partner/audit-logs', label: 'Nhật ký', icon: ScrollText },
  { to: '/partner/plans', label: 'Gói dịch vụ', icon: Layers },
];

interface PartnerSidebarContentProps {
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  showCollapseToggle?: boolean;
  onToggleCollapsed?: () => void;
}

function PartnerSidebarContent({
  onNavigate,
  showClose,
  onClose,
  collapsed = false,
  showCollapseToggle = false,
  onToggleCollapsed,
}: PartnerSidebarContentProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Đã đăng xuất');
      navigate('/login');
      onNavigate?.();
    } catch {
      toast.error('Không thể đăng xuất, vui lòng thử lại');
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <div
        className={cn(
          'border-b border-sidebar-border/80 px-3 py-4',
          collapsed ? 'flex flex-col items-center gap-2' : 'px-4',
        )}
      >
        <div
          className={cn(
            'flex w-full items-center',
            collapsed ? 'flex-col gap-2' : 'justify-between gap-2',
          )}
        >
          <div className={cn('flex min-w-0 items-center gap-3', collapsed && 'flex-col')}>
            <Logo collapsed={collapsed} markSize={36} />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {showCollapseToggle ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              >
                {collapsed ? (
                  <PanelLeft className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
            ) : null}
            {showClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Đóng menu"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {!collapsed ? (
            <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Partner
            </p>
          ) : null}
          {partnerNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'bg-primary/10 font-medium text-primary ring-1 ring-primary/15'
                      : 'text-sidebar-foreground hover:bg-primary/5 hover:text-primary',
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <div className={cn('border-t border-sidebar-border/80 p-3', collapsed && 'px-2')}>
        <div
          className={cn(
            'rounded-xl border border-sidebar-border/60 bg-background/70 p-3',
            collapsed && 'flex justify-center border-0 bg-transparent p-0',
          )}
        >
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={cn(
              'flex w-full items-center rounded-lg text-left transition-colors hover:bg-primary/5',
              collapsed ? 'mb-2 justify-center p-1' : 'mb-3 gap-3 p-1',
            )}
            aria-label="Xem thông tin tài khoản"
            title="Thông tin tài khoản"
          >
            <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} />
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            ) : null}
          </button>
          <div className={cn('flex gap-2', collapsed ? 'flex-col items-center' : 'items-center')}>
            <ThemeToggle />
            <Button
              type="button"
              variant="outline"
              size={collapsed ? 'icon-sm' : 'sm'}
              className={cn(!collapsed && 'flex-1')}
              onClick={handleLogout}
              aria-label="Đăng xuất"
              title={collapsed ? 'Đăng xuất' : undefined}
            >
              <LogOut className="size-4" />
              {!collapsed ? 'Đăng xuất' : null}
            </Button>
          </div>
        </div>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

function DesktopPartnerSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-svh',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <PartnerSidebarContent
        collapsed={collapsed}
        showCollapseToggle
        onToggleCollapsed={onToggleCollapsed}
      />
    </aside>
  );
}

function MobilePartnerSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        aria-label="Đóng menu"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,18rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl lg:hidden">
        <PartnerSidebarContent onNavigate={onClose} showClose onClose={onClose} />
      </aside>
    </>
  );
}

export function PartnerLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapsed(
    'xcash_partner_sidebar_collapsed',
  );

  return (
    <div className="flex h-svh items-stretch overflow-hidden bg-muted">
      <DesktopPartnerSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />
      <MobilePartnerSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

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
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
