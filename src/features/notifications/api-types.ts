import type { AppNotification } from "./domain/contracts";

export interface NotificationCapabilities {
  getAll(): AppNotification[];
  getUnread(): AppNotification[];
  getUnreadCount(): number;
  add(notification: AppNotification): void;
  markRead(id: string): void;
  markAllRead(): void;
  remove(id: string): void;
  clear(): void;
  observeUnreadCount(callback: (count: number) => void): () => void;
}
