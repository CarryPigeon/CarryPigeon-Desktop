/**
 * @fileoverview 本地消息收藏存储。
 * @description chat/message-flow/bookmark｜data：基于 localStorage 的收藏持久化。
 */

const STORAGE_KEY = "cp_bookmarks";

/**
 * 收藏条目模型。
 */
export interface BookmarkEntry {
  /** 消息 ID。 */
  messageId: string;
  /** 消息所属频道 ID。 */
  channelId: string;
  /** 消息所属频道名称。 */
  channelName: string;
  /** 消息内容预览。 */
  contentPreview: string;
  /** 消息发送者名称。 */
  senderName: string;
  /** 收藏时间戳。 */
  bookmarkedAt: number;
}

function isBookmarkEntry(item: unknown): item is BookmarkEntry {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as BookmarkEntry).messageId === "string" &&
    typeof (item as BookmarkEntry).channelId === "string"
  );
}

function toLegacyEntry(messageId: string, bookmarkedAt: number): BookmarkEntry {
  return {
    messageId,
    channelId: "",
    channelName: "",
    contentPreview: "",
    senderName: "",
    bookmarkedAt,
  };
}

/**
 * 从 localStorage 读取所有收藏。
 */
export function loadBookmarks(): BookmarkEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBookmarkEntry);
  } catch {
    return [];
  }
}

/**
 * 将收藏列表写入 localStorage。
 */
export function saveBookmarks(entries: BookmarkEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * 添加一条收藏。
 */
export function addBookmark(entry: BookmarkEntry): BookmarkEntry[] {
  const bookmarks = loadBookmarks();
  if (bookmarks.some((b) => b.messageId === entry.messageId)) return bookmarks;
  const updated = [entry, ...bookmarks];
  saveBookmarks(updated);
  return updated;
}

/**
 * 移除指定消息的收藏。
 */
export function removeBookmark(messageId: string): BookmarkEntry[] {
  const bookmarks = loadBookmarks();
  const updated = bookmarks.filter((b) => b.messageId !== messageId);
  saveBookmarks(updated);
  return updated;
}

/**
 * 检查消息是否已收藏。
 */
export function isBookmarked(messageId: string): boolean {
  return loadBookmarks().some((b) => b.messageId === messageId);
}

/**
 * 添加多条收藏（按 messageId 去重，保留已有条目）。
 */
export function addBookmarks(entries: BookmarkEntry[]): BookmarkEntry[] {
  migrateLegacyBookmarks();
  const bookmarks = loadBookmarks();
  const seen = new Set(bookmarks.map((b) => b.messageId));
  const next = [...bookmarks];
  for (const entry of entries) {
    if (!entry.messageId || seen.has(entry.messageId)) continue;
    seen.add(entry.messageId);
    next.unshift(entry);
  }
  if (next.length !== bookmarks.length) {
    saveBookmarks(next);
  }
  return next;
}

/**
 * 从旧格式（纯 messageId 字符串数组，或字符串与对象混合数组）迁移到新格式。
 * 在首次运行时自动完成。
 */
export function migrateLegacyBookmarks(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return;
    const hasLegacy = parsed.some((item) => typeof item === "string");
    if (!hasLegacy) return;

    const now = Date.now();
    const seen = new Set<string>();
    const migrated: BookmarkEntry[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const messageId = item.trim();
        if (!messageId || seen.has(messageId)) continue;
        seen.add(messageId);
        migrated.push(toLegacyEntry(messageId, now));
        continue;
      }
      if (isBookmarkEntry(item) && !seen.has(item.messageId)) {
        seen.add(item.messageId);
        migrated.push(item);
      }
    }
    saveBookmarks(migrated);
  } catch {
    // Ignore migration errors
  }
}
