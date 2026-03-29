/**
 * @fileoverview 频道管理动作上下文（共享依赖与作用域守卫）。
 * @description chat/room-governance｜application/usecases/admin-actions：context。
 */

import type { GovernanceApiPort } from "../../ports";
import type { CreateScopeGuard } from "../../policies/scopeGuard";
export type { ScopeGuard, CreateScopeGuard } from "../../policies/scopeGuard";
export { createScopeGuardFactory } from "../../policies/scopeGuard";

/**
 * 获取当前 server socket 与可用 access token（均为 trim 后）。
 */
export type GetSocketAndValidToken = () => Promise<[string, string]>;

/**
 * 频道管理动作共享依赖。
 */
export type AdminActionsBaseDeps = {
  api: GovernanceApiPort;
  getSocketAndValidToken: GetSocketAndValidToken;
  createScopeGuard: CreateScopeGuard;
};
