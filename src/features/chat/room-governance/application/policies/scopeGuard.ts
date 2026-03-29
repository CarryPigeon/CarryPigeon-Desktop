/**
 * @fileoverview room-governance 作用域守卫工具。
 * @description chat/room-governance｜application：请求作用域一致性守卫。
 */

/**
 * 作用域失效判断函数（返回 true 表示请求已过期）。
 */
export type ScopeGuard = () => boolean;

/**
 * 基于请求 socket 创建作用域守卫。
 */
export type CreateScopeGuard = (requestSocket: string) => ScopeGuard;

/**
 * 创建“请求作用域守卫”工厂。
 *
 * @param getActiveServerSocket - 当前激活 server socket。
 * @param getActiveScopeVersion - 当前 server-scope 版本。
 * @returns `CreateScopeGuard`。
 */
export function createScopeGuardFactory(
  getActiveServerSocket: () => string,
  getActiveScopeVersion: () => number,
): CreateScopeGuard {
  return (requestSocket: string) => {
    const requestScopeVersion = getActiveScopeVersion();
    return () => getActiveServerSocket() !== requestSocket || getActiveScopeVersion() !== requestScopeVersion;
  };
}
