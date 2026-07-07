import { useCallback, useState } from 'react';

export function useSidebarCollapsed(storageKey: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return defaultCollapsed;
      return stored === '1';
    } catch {
      return defaultCollapsed;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  }, [storageKey]);

  return [collapsed, toggleCollapsed] as const;
}
