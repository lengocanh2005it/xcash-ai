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
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/Logo';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCount } from '@/hooks/useReviewCount';
import { hasPlanAccess } from '@/lib/plan';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** Gói tối thiểu để dùng — hiện icon khóa nếu chưa đủ. */
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

          <div className={cn('flex shrink-0 items-center gap-1', collapsed && 'flex-col gap-2')}>
            <NotificationBell align="left" />
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
                  <PanelLeftOpen className="size-4" />
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
              Menu chính
            </p>
          ) : null}
          {primaryNavItems.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
              badgeCount={item.to === '/review' ? reviewCount : undefined}
              locked={item.minPlan ? !hasPlanAccess(user?.plan, item.minPlan) : false}
            />
          ))}
        </div>
      </nav>

      <div className={cn('border-t border-sidebar-border/80 p-3', collapsed && 'px-2')}>
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
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
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
            <LogOut className="size-4" />
            {!collapsed ? 'Đăng xuất' : null}
          </Button>
        </div>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

interface DesktopSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function DesktopSidebar({ collapsed, onToggleCollapsed }: DesktopSidebarProps) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-svh',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        showCollapseToggle
        onToggleCollapsed={onToggleCollapsed}
      />
    </aside>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        aria-label="Đóng menu"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,18rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl lg:hidden">
        <SidebarContent onNavigate={onClose} showClose onClose={onClose} />
      </aside>
    </>
  );
}
