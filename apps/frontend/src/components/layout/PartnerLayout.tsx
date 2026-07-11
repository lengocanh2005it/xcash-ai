import {
  Bot,
  Building2,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/Logo';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed';
import { cn } from '@/lib/utils';
import { DesktopSidebarWrapper, MobileSidebarWrapper, SidebarShell } from './SidebarShell';

const partnerNavItems = [
  { to: '/partner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/partner/tenants', label: 'Doanh nghiệp', icon: Building2 },
  { to: '/partner/payments', label: 'Lịch sử thanh toán', icon: Receipt },
  { to: '/partner/audit-logs', label: 'Nhật ký', icon: ScrollText },
  { to: '/partner/plans', label: 'Gói dịch vụ', icon: Layers },
  { to: '/partner/ai-costs', label: 'Chi phí AI', icon: Bot },
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
    <>
      <SidebarShell
        collapsed={collapsed}
        showCollapseToggle={showCollapseToggle}
        onToggleCollapsed={onToggleCollapsed}
        showClose={showClose}
        onClose={onClose}
        navLabel="Partner"
        navItems={partnerNavItems.map((item) => {
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
        footer={
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
        }
      />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
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
    <DesktopSidebarWrapper collapsed={collapsed}>
      <PartnerSidebarContent
        collapsed={collapsed}
        showCollapseToggle
        onToggleCollapsed={onToggleCollapsed}
      />
    </DesktopSidebarWrapper>
  );
}

function MobilePartnerSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <MobileSidebarWrapper open={open} onClose={onClose}>
      <PartnerSidebarContent onNavigate={onClose} showClose onClose={onClose} />
    </MobileSidebarWrapper>
  );
}

export function PartnerLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapsed(
    'xcash_partner_sidebar_collapsed',
  );

  return (
    <div className="flex h-svh items-stretch overflow-hidden bg-muted">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Chuyển đến nội dung chính
      </a>
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
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
