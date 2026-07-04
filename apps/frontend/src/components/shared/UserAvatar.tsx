import { cn } from '@/lib/utils';

function getInitials(name?: string | null) {
  if (!name?.trim()) {
    return 'U';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'size-9 text-xs',
  md: 'size-14 text-sm',
  lg: 'size-20 text-xl',
};

const sizePixels = {
  sm: 36,
  md: 56,
  lg: 80,
} as const;

export function UserAvatar({ name, avatarUrl, size = 'sm', className }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const pixelSize = sizePixels[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ? `Ảnh đại diện ${name}` : 'Ảnh đại diện'}
        width={pixelSize}
        height={pixelSize}
        decoding="async"
        className={cn('shrink-0 rounded-full object-cover object-center', sizeClass, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
        sizeClass,
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export { getInitials };
