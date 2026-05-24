/**
 * @fileoverview localStorage-backed draft storage. Keys are scoped by server socket to prevent cross-server leaks.
 */

import type { DraftRecord, DraftStoragePort } from "../domain/draftStoragePort";

const DRAFT_STORAGE_PREFIX = "cp_draft_";
let cache: Record<string, DraftRecord | null> = {};

function storageKey(serverSocket: string, channelId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${serverSocket}:${channelId}`;
}

export function createLocalStorageDraftStorage(getServerSocket: () => string): DraftStoragePort {
  function readDraft(channelId: string): DraftRecord | null {
    const key = storageKey(getServerSocket(), channelId);
    if (key in cache) return cache[key] ?? null;
    const raw = localStorage.getItem(key);
    if (!raw) {
      cache[key] = null;
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as DraftRecord;
      if (!parsed?.channelId) {
        cache[key] = null;
        return null;
      }
      cache[key] = parsed;
      return parsed;
    } catch {
      cache[key] = null;
      return null;
    }
  }

  function saveDraft(draft: DraftRecord): void {
    const key = storageKey(getServerSocket(), draft.channelId);
    const serialized = JSON.stringify(draft);
    localStorage.setItem(key, serialized);
    cache[key] = draft;
  }

  function deleteDraft(channelId: string): void {
    const key = storageKey(getServerSocket(), channelId);
    localStorage.removeItem(key);
    delete cache[key];
  }

  return { readDraft, saveDraft, deleteDraft };
}
