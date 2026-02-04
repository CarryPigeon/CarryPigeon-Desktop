/**
 * @fileoverview 轻量 JSON 存储工具（localStorage）。
 * @description 将安全的 JSON 读写收敛到一处，供各 feature 的数据 store 复用。
 */

/**
 * 从 localStorage 读取 JSON 值。
 *
 * 该工具刻意保持防御性：无论解析错误、配额问题，或隐私模式拒绝访问，都会回退到默认值。
 *
 * @param key - localStorage key。
 * @param fallback - 当 key 缺失或非法时的返回值。
 * @returns 解析后的 JSON 值；不可用时返回 `fallback`。
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
 * 将 JSON 值写入 localStorage。
 *
 * 存储错误会被刻意吞掉，以便在受限环境（配额超限、隐私模式等）下保持 UI 流程韧性。
 *
 * @param key - localStorage key。
 * @param value - 要序列化并写入的值。
 * @returns void
 */
export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略存储失败（配额、隐私模式等）。
  }
}
