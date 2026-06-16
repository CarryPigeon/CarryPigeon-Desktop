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

/**
 * 从 localStorage 读取所有收藏。
 */
export function loadBookmarks(): BookmarkEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is BookmarkEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as BookmarkEntry).messageId === "string" &&
        typeof (item as BookmarkEntry).channelId === "string",
    );
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
 * 从旧格式（纯 messageId 字符串数组）迁移到新格式。
 * 在首次运行时自动完成。
 */
export function migrateLegacyBookmarks(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const isLegacy = parsed.length > 0 && typeof parsed[0] === "string";
    if (!isLegacy) return;
    // Legacy format: ["msgId1", "msgId2", ...]
    const migrated: BookmarkEntry[] = (parsed as string[]).map((mid) => ({
      messageId: mid,
      channelId: "",
      channelName: "",
      contentPreview: "",
      senderName: "",
      bookmarkedAt: Date.now(),
    }));
    saveBookmarks(migrated);
  } catch {
    // Ignore migration errors
  }
}
