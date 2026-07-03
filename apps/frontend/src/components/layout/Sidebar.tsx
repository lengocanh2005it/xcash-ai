import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Receipt,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

export const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Giao dịch', icon: Receipt },
  { to: '/review', label: 'Human Review', icon: ClipboardCheck },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { to: '/accounts', label: 'Danh mục TK', icon: BookOpen },
  { to: '/copilot', label: 'AI Copilot', icon: Bot, disabled: true },
  { to: '/settings', label: 'Cài đặt', icon: Settings, disabled: true },
];

const primaryNavItems = navItems.filter((item) => !item.disabled);
const comingSoonNavItems = navItems.filter((item) => item.disabled);

function getInitials(name?: string | null) {
  if (!name?.trim()) {
    return 'KL';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

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
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors',
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
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              {collapsed ? 'K' : 'KL'}
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Klassi AI</p>
                <p className="truncate text-xs text-muted-foreground">Định khoản tự động</p>
              </div>
            ) : null}
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
              Menu chính
            </p>
          ) : null}
          {primaryNavItems.map((item) => (
            <NavItemLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>

        {!collapsed && comingSoonNavItems.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 pb-1">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Sắp ra mắt
              </p>
              <Sparkles className="size-3 text-muted-foreground" />
            </div>
            {comingSoonNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.to}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground/80"
                  title="Tính năng sẽ có ở Sprint sau"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="size-4 shrink-0 opacity-60" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                    Soon
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : null}
      </nav>

      <div className={cn('border-t border-sidebar-border/80 p-3', collapsed && 'px-2')}>
        <div
          className={cn(
            'rounded-xl border border-sidebar-border/60 bg-background/70 p-3',
            collapsed && 'flex justify-center border-0 bg-transparent p-0',
          )}
        >
          {!collapsed ? (
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          ) : null}
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
