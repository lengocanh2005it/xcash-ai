import { useCallback, useState } from 'react';

export function useSidebarCollapsed(storageKey: string) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
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
