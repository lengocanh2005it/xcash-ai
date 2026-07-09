import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppNotification, NotificationListResult } from '@xcash/shared-types';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  API_BASE_URL,
  deleteApiData,
  getApiData,
  getValidAccessToken,
  markLogoutInitiated,
  patchApiData,
} from '@/lib/api';
import { useAuth } from './useAuth';
import { useSseStream } from './useSseStream';

export function useNotifications() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const connect = useCallback(async () => {
    const token = await getValidAccessToken();
    if (!token) {
      markLogoutInitiated();
      toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      await logout();
      return null;
    }
    return new EventSource(`${API_BASE_URL}/notifications/stream?token=${token}`);
  }, [logout]);

  const onMessage = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  const sseOptions = useMemo(
    () => ({ enabled: !!user?.tenantId, connect, onMessage }),
    [user?.tenantId, connect, onMessage],
  );

  useSseStream(sseOptions);

  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => getApiData<NotificationListResult>('/notifications?limit=20'),
    enabled: !!user?.tenantId,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patchApiData<AppNotification>(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => patchApiData<{ updated: number }>('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteApiData<{ deleted: number }>(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Đã xóa thông báo');
    },
  });
}

export function useDeleteNotifications() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      deleteApiData<{ deleted: number }, { ids: string[] }>('/notifications', { ids }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`Đã xóa ${result.deleted} thông báo`);
    },
  });
}

export function useDeleteAllNotifications() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => deleteApiData<{ deleted: number }>('/notifications/all'),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`Đã xóa tất cả ${result.deleted} thông báo`);
    },
  });
}
