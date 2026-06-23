import { ref } from "vue";
import type { AppNotification, NotificationStore } from "../domain/contracts";

const STORAGE_KEY = "cp-notifications";

function loadPersisted(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(items: AppNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full or unavailable — degrade silently
  }
}

const notifications = ref<AppNotification[]>(loadPersisted());

export function createNotificationStore(): NotificationStore {
  return {
    getAll: () => notifications.value,
    getUnread: () => notifications.value.filter((n) => !n.read),
    add: (notification) => {
      notifications.value.unshift(notification);
      persist(notifications.value);
    },
    markRead: (id) => {
      const n = notifications.value.find((n) => n.id === id);
      if (n) {
        n.read = true;
        persist(notifications.value);
      }
    },
    markAllRead: () => {
      notifications.value.forEach((n) => { n.read = true; });
      persist(notifications.value);
    },
    remove: (id) => {
      notifications.value = notifications.value.filter((n) => n.id !== id);
      persist(notifications.value);
    },
    clear: () => {
      notifications.value = [];
      persist(notifications.value);
    },
  };
}
