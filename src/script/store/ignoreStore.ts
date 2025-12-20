import { reactive } from "vue";

const STORAGE_KEY = "carrypigeon:ignored-user-ids";

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

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ignoreState.ignoredUserIds));
  } catch {
    // ignore
  }
}

export function useIgnoreStore() {
  return {
    ignoredUserIds: ignoreState.ignoredUserIds,
    ignoreUser,
    unignoreUser,
    toggleIgnoreUser,
    isIgnoredUser,
  };
}

export function isIgnoredUser(uid: number): boolean {
  if (!Number.isFinite(uid)) return false;
  return ignoreState.ignoredUserIds.includes(uid);
}

export function ignoreUser(uid: number): void {
  if (!Number.isFinite(uid)) return;
  if (ignoreState.ignoredUserIds.includes(uid)) return;
  ignoreState.ignoredUserIds.push(uid);
  persist();
}

export function unignoreUser(uid: number): void {
  if (!Number.isFinite(uid)) return;
  const index = ignoreState.ignoredUserIds.indexOf(uid);
  if (index < 0) return;
  ignoreState.ignoredUserIds.splice(index, 1);
  persist();
}

export function toggleIgnoreUser(uid: number): void {
  if (isIgnoredUser(uid)) unignoreUser(uid);
  else ignoreUser(uid);
}

