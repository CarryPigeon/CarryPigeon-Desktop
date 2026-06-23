export interface AppNotification {
  id: string;
  type: "message" | "mention" | "file_share" | "system" | "call";
  channelId: string;
  serverId?: string;
  title: string;
  summary: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationStore {
  getAll(): AppNotification[];
  getUnread(): AppNotification[];
  add(notification: AppNotification): void;
  markRead(id: string): void;
  markAllRead(): void;
  remove(id: string): void;
  clear(): void;
}
