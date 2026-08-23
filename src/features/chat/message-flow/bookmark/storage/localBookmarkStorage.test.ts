/**
 * @fileoverview 本地收藏存储：旧格式 / 混合数组迁移。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addBookmark,
  addBookmarks,
  loadBookmarks,
  migrateLegacyBookmarks,
  type BookmarkEntry,
} from "./localBookmarkStorage";

const STORAGE_KEY = "cp_bookmarks";

const memory = new Map<string, string>();
const memoryStorage = {
  getItem(key: string): string | null {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
  },
  removeItem(key: string): void {
    memory.delete(key);
  },
  clear(): void {
    memory.clear();
  },
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memoryStorage,
});

function entry(overrides: Partial<BookmarkEntry> = {}): BookmarkEntry {
  return {
    messageId: "msg-1",
    channelId: "ch-1",
    channelName: "general",
    contentPreview: "hello",
    senderName: "Alice",
    bookmarkedAt: 1_700_000_000_000,
    ...overrides,
  };
}

beforeEach(() => {
  memory.clear();
});

afterEach(() => {
  memory.clear();
});

describe("migrateLegacyBookmarks", () => {
  it("migrates a pure string array to BookmarkEntry objects", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["msg-a", "msg-b"]));
    migrateLegacyBookmarks();
    const loaded = loadBookmarks();
    expect(loaded.map((b) => b.messageId)).toEqual(["msg-a", "msg-b"]);
    expect(loaded.every((b) => b.channelId === "")).toBe(true);
  });

  it("migrates a mixed array of strings and objects without dropping either", () => {
    const existing = entry({ messageId: "msg-obj", channelId: "ch-9", contentPreview: "keep" });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["msg-legacy", existing, "msg-legacy"]));
    migrateLegacyBookmarks();
    const loaded = loadBookmarks();
    expect(loaded.map((b) => b.messageId)).toEqual(["msg-legacy", "msg-obj"]);
    expect(loaded.find((b) => b.messageId === "msg-obj")).toMatchObject({
      channelId: "ch-9",
      contentPreview: "keep",
    });
  });

  it("leaves a modern BookmarkEntry array unchanged", () => {
    const modern = [entry({ messageId: "msg-keep" })];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modern));
    migrateLegacyBookmarks();
    expect(loadBookmarks()).toEqual(modern);
  });
});

describe("addBookmarks", () => {
  it("migrates leftover string ids before appending new entries", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["msg-old"]));
    addBookmarks([entry({ messageId: "msg-new", channelId: "ch-2" })]);
    const loaded = loadBookmarks();
    expect(loaded.map((b) => b.messageId)).toEqual(["msg-new", "msg-old"]);
  });

  it("does not duplicate an already bookmarked message", () => {
    addBookmark(entry({ messageId: "msg-1" }));
    addBookmarks([entry({ messageId: "msg-1", contentPreview: "newer" })]);
    expect(loadBookmarks()).toHaveLength(1);
    expect(loadBookmarks()[0]?.contentPreview).toBe("hello");
  });
});
