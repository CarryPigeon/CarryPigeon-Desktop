import type { NotificationCapabilities } from "./api-types";
import { createNotificationStore } from "./data/notificationStore";
import type { AppNotification } from "./domain/contracts";

let capabilities: NotificationCapabilities | null = null;
let callbacks: Array<(count: number) => void> = [];

function notifyCallbacks(): void {
  const count = capabilities?.getUnreadCount() ?? 0;
  callbacks.forEach((cb) => cb(count));
}

function createCapabilities(): NotificationCapabilities {
  const store = createNotificationStore();

  return {
    getAll: () => store.getAll(),
    getUnread: () => store.getUnread(),
    getUnreadCount: () => store.getUnread().length,
    add: (notification: AppNotification) => {
      store.add(notification);
      notifyCallbacks();
    },
    markRead: (id: string) => {
      store.markRead(id);
      notifyCallbacks();
    },
    markAllRead: () => {
      store.markAllRead();
      notifyCallbacks();
    },
    remove: (id: string) => {
      store.remove(id);
      notifyCallbacks();
    },
    clear: () => {
      store.clear();
      notifyCallbacks();
    },
    observeUnreadCount: (callback: (count: number) => void) => {
      callbacks.push(callback);
      callback(capabilities?.getUnreadCount() ?? 0);
      return () => {
        callbacks = callbacks.filter((cb) => cb !== callback);
      };
    },
  };
}

export function getNotificationCapabilities(): NotificationCapabilities {
  capabilities ??= createCapabilities();
  return capabilities;
}
