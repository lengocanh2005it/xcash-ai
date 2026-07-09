import { type ReactElement, useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface DebouncedResponsiveContainerProps {
  children: ReactElement;
  /** Fixed height in px. Omit to measure from the parent. */
  height?: number;
  /** Used when height is omitted. */
  minHeight?: number;
  /** Wait until resize settles — matches sidebar width transition (~200ms). */
  debounceMs?: number;
  className?: string;
}

/**
 * Recharts ResponsiveContainer redraws on every resize frame. During sidebar
 * width animation the parent width changes ~12 times in 200ms, which is costly
 * on chart-heavy pages (Dashboard). Debounce dimension updates so charts redraw
 * once after the layout settles.
 */
export function DebouncedResponsiveContainer({
  children,
  height,
  minHeight = 0,
  debounceMs = 200,
  className,
}: DebouncedResponsiveContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const isFirstMeasure = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout>;

    const applySize = (width: number, measuredHeight: number) => {
      const resolvedHeight = height ?? measuredHeight;
      const next = {
        width: Math.floor(width),
        height: Math.floor(resolvedHeight),
      };
      if (next.width <= 0 || next.height <= 0) return;

      if (isFirstMeasure.current) {
        isFirstMeasure.current = false;
        setSize(next);
        return;
      }

      clearTimeout(timer);
      timer = setTimeout(() => setSize(next), debounceMs);
    };

    const ro = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect;
      applySize(width, h);
    });

    ro.observe(el);
    const rect = el.getBoundingClientRect();
    applySize(rect.width, rect.height);

    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, [debounceMs, height]);

  const chartHeight = height ?? size?.height ?? minHeight;

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={height != null ? { height } : { minHeight, height: '100%' }}
    >
      {size && size.width > 0 && chartHeight > 0 ? (
        <ResponsiveContainer width={size.width} height={chartHeight}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
