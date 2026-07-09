import { SubscriptionPlan } from '@xcash/shared-types';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardCheck,
  LayoutDashboard,
  LineChart,
  Lock,
  LogOut,
  Receipt,
  Settings,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SidebarCollapseFade } from '@/components/layout/SidebarCollapseFade';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCount } from '@/hooks/useReviewCount';
import { hasPlanAccess } from '@/lib/plan';
import { cn } from '@/lib/utils';
import { DesktopSidebarWrapper, MobileSidebarWrapper, SidebarShell } from './SidebarShell';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  minPlan?: SubscriptionPlan;
}

export const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Giao dịch', icon: Receipt },
  { to: '/review', label: 'Human Review', icon: ClipboardCheck },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { to: '/analytics', label: 'Phân tích', icon: LineChart, minPlan: SubscriptionPlan.STARTER },
  { to: '/accounts', label: 'Danh mục TK', icon: BookOpen },
  { to: '/copilot', label: 'AI Copilot', icon: Bot, minPlan: SubscriptionPlan.STARTER },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];

const primaryNavItems = navItems;

interface SidebarContentProps {
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  showCollapseToggle?: boolean;
  onToggleCollapsed?: () => void;
}

function NavItemLink({
  item,
  collapsed,
  onNavigate,
  badgeCount,
  locked,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
  locked?: boolean;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center rounded-lg text-sm transition-colors',
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'bg-primary/10 font-medium text-primary ring-1 ring-primary/15'
            : 'text-sidebar-foreground hover:bg-primary/5 hover:text-primary',
        )
      }
    >
      <Icon className={cn('shrink-0', collapsed ? 'size-5' : 'size-4')} />
      {!collapsed ? (
        <SidebarCollapseFade collapsed={false} className="truncate">
          {item.label}
        </SidebarCollapseFade>
      ) : null}
      {badgeCount ? (
        <span
          className={cn(
            'flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white',
            collapsed ? 'absolute top-1 right-1' : 'ml-auto',
          )}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      ) : locked ? (
        <Lock
          className={cn(
            'size-3.5 text-muted-foreground',
            collapsed ? 'absolute top-1 right-1' : 'ml-auto',
          )}
        />
      ) : null}
    </NavLink>
  );
}

export function SidebarContent({
  onNavigate,
  showClose,
  onClose,
  collapsed = false,
  showCollapseToggle = false,
  onToggleCollapsed,
}: SidebarContentProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: reviewCount } = useReviewCount();
  const prevReviewCount = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (
      reviewCount !== undefined &&
      prevReviewCount.current !== undefined &&
      reviewCount > prevReviewCount.current
    ) {
      const delta = reviewCount - prevReviewCount.current;
      toast.info(`Có ${delta} giao dịch mới cần review`);
    }
    prevReviewCount.current = reviewCount;
  }, [reviewCount]);

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
        headerRight={<NotificationBell align="left" collapsed={collapsed} />}
        navLabel="Menu chính"
        navItems={primaryNavItems.map((item) => (
          <NavItemLink
            key={item.to}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
            badgeCount={item.to === '/review' ? reviewCount : undefined}
            locked={item.minPlan ? !hasPlanAccess(user?.plan, item.minPlan) : false}
          />
        ))}
        footer={
          <div
            className={cn(
              'rounded-xl border border-sidebar-border/60 bg-background/70 p-3',
              collapsed && 'flex flex-col items-center border-0 bg-transparent p-0',
            )}
          >
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className={cn(
                'flex w-full items-center rounded-lg text-left transition-colors hover:bg-primary/5',
                collapsed ? 'justify-center p-1' : 'mb-3 gap-3 p-1',
              )}
              aria-label="Xem thông tin tài khoản"
              title="Thông tin tài khoản"
            >
              <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} />
              {!collapsed ? (
                <SidebarCollapseFade collapsed={false} block className="min-w-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </SidebarCollapseFade>
              ) : null}
            </button>
            <Button
              type="button"
              variant="outline"
              size={collapsed ? 'icon-sm' : 'sm'}
              className={cn(!collapsed && 'w-full')}
              onClick={handleLogout}
              aria-label="Đăng xuất"
              title={collapsed ? 'Đăng xuất' : undefined}
            >
              <LogOut className={cn(collapsed ? 'size-5' : 'size-4')} />
              {!collapsed ? (
                <SidebarCollapseFade collapsed={false}>Đăng xuất</SidebarCollapseFade>
              ) : null}
            </Button>
          </div>
        }
      />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

interface DesktopSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function DesktopSidebar({ collapsed, onToggleCollapsed }: DesktopSidebarProps) {
  return (
    <DesktopSidebarWrapper collapsed={collapsed}>
      <SidebarContent
        collapsed={collapsed}
        showCollapseToggle
        onToggleCollapsed={onToggleCollapsed}
      />
    </DesktopSidebarWrapper>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <MobileSidebarWrapper open={open} onClose={onClose}>
      <SidebarContent onNavigate={onClose} showClose onClose={onClose} />
    </MobileSidebarWrapper>
  );
}
