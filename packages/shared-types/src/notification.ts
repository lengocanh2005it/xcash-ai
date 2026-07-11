import type { NotificationType } from './generated/enums';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: AppNotification[];
  unreadCount: number;
  total: number;
}
