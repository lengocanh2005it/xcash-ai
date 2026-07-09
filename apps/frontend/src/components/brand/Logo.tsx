import { useId } from 'react';
import { SidebarCollapseFade } from '@/components/layout/SidebarCollapseFade';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

const palettes = {
  light: {
    bg: ['#1BC477', '#0B8F4E'],
    stroke: '#FFFFFF',
    dot: '#FFFFFF',
    ring: 'transparent',
    shadow: 'shadow-sm',
  },
  dark: {
    bg: ['#0F5C40', '#062E22'],
    stroke: '#6EE7B7',
    dot: '#A7F3D0',
    ring: '#1BC477',
    shadow: 'shadow-[0_0_14px_rgba(27,196,119,0.35)] ring-1 ring-primary/40',
  },
} as const;

/** Icon mark — X + dòng tiền; tự đổi palette theo light/dark theme */
export function LogoMark({ size = 36, className }: LogoMarkProps) {
  const { theme } = useTheme();
  const uid = useId().replace(/:/g, '');
  const palette = palettes[theme];
  const gradientId = `xcash-logo-bg-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 rounded-xl', palette.shadow, className)}
      aria-hidden={true}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={palette.bg[0]} />
          <stop stopColor={palette.bg[1]} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      {palette.ring !== 'transparent' ? (
        <rect
          width="31"
          height="31"
          x="0.5"
          y="0.5"
          rx="7.5"
          fill="none"
          stroke={palette.ring}
          strokeOpacity="0.55"
        />
      ) : null}
      <path
        stroke={palette.stroke}
        strokeLinecap="round"
        strokeWidth="3.5"
        d="M9.5 9.5 16 16m0 0 6.5 6.5M22.5 9.5 16 16m0 0-6.5 6.5"
      />
      <circle cx="16" cy="16" r="2.35" fill={palette.dot} />
      <path
        stroke={palette.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.25"
        d="M19.5 10v3.75M19.5 10l-2.25 2.25"
      />
    </svg>
  );
}

interface LogoProps {
  collapsed?: boolean;
  markSize?: number;
  className?: string;
}

export function Logo({ collapsed = false, markSize = 36, className }: LogoProps) {
  return (
    <div
      className={cn('flex min-w-0 items-center gap-3', collapsed && 'justify-center', className)}
    >
      <LogoMark size={markSize} />
      {!collapsed ? (
        <SidebarCollapseFade collapsed={false} block className="min-w-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">X-Cash AI</p>
            <p className="truncate text-xs text-muted-foreground">Định khoản tự động</p>
          </div>
        </SidebarCollapseFade>
      ) : null}
    </div>
  );
}
