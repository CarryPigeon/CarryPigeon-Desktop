/**
 * @fileoverview ignoreStoreImpl.ts 文件职责说明。
 */
import { reactive } from "vue";

const STORAGE_KEY = "carrypigeon:ignored-user-ids";

/**
 * loadIgnoredUserIds 方法说明。
 * @returns 返回值说明。
 */
function loadIgnoredUserIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => (typeof id === "number" ? id : Number.parseInt(String(id), 10)))
      .filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

const ignoreState = reactive<{ ignoredUserIds: number[] }>({
  ignoredUserIds: loadIgnoredUserIds(),
});

/**
 * persist 方法说明。
 * @returns 返回值说明。
 */
function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ignoreState.ignoredUserIds));
  } catch {
    // ignore
  }
}

/**
 * useIgnoreStore 方法说明。
 * @returns 返回值说明。
 */
export function useIgnoreStore() {
  return {
    ignoredUserIds: ignoreState.ignoredUserIds,
    ignoreUser,
    unignoreUser,
    toggleIgnoreUser,
    isIgnoredUser,
  };
}

/**
 * isIgnoredUser 方法说明。
 * @param uid - 参数说明。
 * @returns 返回值说明。
 */
export function isIgnoredUser(uid: number): boolean {
  if (!Number.isFinite(uid)) return false;
  return ignoreState.ignoredUserIds.includes(uid);
}

/**
 * ignoreUser 方法说明。
 * @param uid - 参数说明。
 * @returns 返回值说明。
 */
export function ignoreUser(uid: number): void {
  if (!Number.isFinite(uid)) return;
  if (ignoreState.ignoredUserIds.includes(uid)) return;
  ignoreState.ignoredUserIds.push(uid);
  persist();
}

/**
 * unignoreUser 方法说明。
 * @param uid - 参数说明。
 * @returns 返回值说明。
 */
export function unignoreUser(uid: number): void {
  if (!Number.isFinite(uid)) return;
  const index = ignoreState.ignoredUserIds.indexOf(uid);
  if (index < 0) return;
  ignoreState.ignoredUserIds.splice(index, 1);
  persist();
}

/**
 * toggleIgnoreUser 方法说明。
 * @param uid - 参数说明。
 * @returns 返回值说明。
 */
export function toggleIgnoreUser(uid: number): void {
  if (isIgnoredUser(uid)) unignoreUser(uid);
  else ignoreUser(uid);
}

