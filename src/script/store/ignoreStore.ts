import { reactive } from "vue";

// 存储被忽略用户ID的本地存储键名
const STORAGE_KEY = "carrypigeon:ignored-user-ids";

/**
 * 从本地存储加载被忽略的用户ID列表
 * @returns 被忽略的用户ID数组
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

// 响应式状态，存储被忽略的用户ID
const ignoreState = reactive<{ ignoredUserIds: number[] }>({
  ignoredUserIds: loadIgnoredUserIds(),
});

/**
 * 将被忽略的用户ID持久化到本地存储
 */
function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ignoreState.ignoredUserIds));
  } catch {
    // 忽略存储错误
  }
}

/**
 * 忽略用户状态管理的组合函数
 * @returns 提供用户忽略功能的对象
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
 * 检查指定用户ID是否被忽略
 * @param uid 用户ID
 * @returns 如果用户被忽略则返回true，否则返回false
 */
export function isIgnoredUser(uid: number): boolean {
  if (!Number.isFinite(uid)) return false;
  return ignoreState.ignoredUserIds.includes(uid);
}

/**
 * 忽略指定用户
 * @param uid 用户ID
 */
export function ignoreUser(uid: number): void {
  if (!Number.isFinite(uid)) return;
  if (ignoreState.ignoredUserIds.includes(uid)) return;
  ignoreState.ignoredUserIds.push(uid);
  persist();
}

/**
 * 取消忽略指定用户
 * @param uid 用户ID
 */
export function unignoreUser(uid: number): void {
  if (!Number.isFinite(uid)) return;
  const index = ignoreState.ignoredUserIds.indexOf(uid);
  if (index < 0) return;
  ignoreState.ignoredUserIds.splice(index, 1);
  persist();
}

/**
 * 切换指定用户的忽略状态
 * @param uid 用户ID
 */
export function toggleIgnoreUser(uid: number): void {
  if (isIgnoredUser(uid)) unignoreUser(uid);
  else ignoreUser(uid);
}