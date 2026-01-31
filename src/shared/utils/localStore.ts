/**
 * @fileoverview Lightweight JSON storage helpers (localStorage).
 * @description Centralizes safe JSON read/write for feature data stores.
 */

/**
 * readJson function.
 * @param key - TODO.
 * @param fallback - TODO.
 * @returns TODO.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * writeJson function.
 * @param key - TODO.
 * @param value - TODO.
 */
export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (quota, privacy mode, etc.).
  }
}
