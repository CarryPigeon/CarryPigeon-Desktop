/**
 * @fileoverview clonePlainData.ts
 * @description
 * 为 capability snapshot 提供 plain data 深拷贝，避免跨边界泄漏响应式对象引用。
 */

/**
 * 深拷贝 plain data。
 *
 * @param value - 需要复制的数据。
 * @returns plain data 副本。
 */
export function clonePlainData<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
