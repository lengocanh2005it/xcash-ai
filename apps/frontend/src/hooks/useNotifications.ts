import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppNotification, NotificationListResult } from '@xcash/shared-types';
import { useEffect } from 'react';
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

export function useNotifications() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.tenantId) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = async () => {
      if (closed) return;

      // Đảm bảo token hợp lệ trước khi mở EventSource
      const token = await getValidAccessToken();
      if (!token) {
        // Refresh thất bại — session hết hạn, force logout.
        // markLogoutInitiated() trước để ngăn axios interceptor gọi /auth/logout thêm lần nữa.
        markLogoutInitiated();
        toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        return;
      }
      if (closed) return;

      es = new EventSource(`${API_BASE_URL}/notifications/stream?token=${token}`);

      es.onmessage = () => {
        void qc.invalidateQueries({ queryKey: ['notifications'] });
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!closed) {
          // Chờ rồi reconnect với token mới (getValidAccessToken tự refresh nếu cần)
          reconnectTimer = setTimeout(() => void connect(), 5_000);
        }
      };
    };

    void connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [user?.tenantId, qc]);

  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => getApiData<NotificationListResult>('/notifications?limit=20'),
    enabled: !!user?.tenantId,
    // Giữ refetch 60s làm fallback phòng SSE disconnect
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
