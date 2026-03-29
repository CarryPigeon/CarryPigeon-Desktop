/**
 * @fileoverview room-governance 管理员动作装配层。
 * @description chat/room-governance｜application：组合成员/申请/封禁/频道生命周期等治理动作。
 *
 * 说明：
 * - 该文件仅负责组合各子动作模块，不承载具体 UI 或 store 状态展示逻辑；
 * - 上层 chat application/runtime 装配根通过 room-governance/internal.ts 访问该装配入口。
 */

import type { ApplicationAdminActions } from "./admin-actions/applicationActions";
import { createApplicationAdminActions } from "./admin-actions/applicationActions";
import type { BanAdminActions } from "./admin-actions/banActions";
import { createBanAdminActions } from "./admin-actions/banActions";
import { createChannelLifecycleAdminActions } from "./admin-actions/channelLifecycleActions";
import type { ChannelLifecycleAdminActions } from "./admin-actions/channelLifecycleActions";
import type { AdminActionsBaseDeps } from "./admin-actions/adminActionsContext";
import { createScopeGuardFactory } from "./admin-actions/adminActionsContext";
import type { GetSocketAndValidToken } from "./admin-actions/adminActionsContext";
import type { MemberAdminActions } from "./admin-actions/memberActions";
import { createMemberAdminActions } from "./admin-actions/memberActions";
import type { GovernanceApiPort, GovernanceChannelCatalogPort } from "../ports";

export type { GetSocketAndValidToken };

/**
 * 频道管理动作集合（成员/管理员/申请/封禁/创建/删除）。
 */
export type ChannelAdminActions = MemberAdminActions &
  ApplicationAdminActions &
  BanAdminActions &
  ChannelLifecycleAdminActions;

/**
 * 创建频道管理动作的依赖集合。
 */
export type ChannelAdminActionsDeps = {
  api: GovernanceApiPort;
  getSocketAndValidToken: GetSocketAndValidToken;
  getActiveServerSocket: () => string;
  getActiveScopeVersion: () => number;
  refreshChannels: () => Promise<void>;
  /**
   * 频道目录同步端口（删除后的当前频道校正等）。
   */
  channelCatalog: GovernanceChannelCatalogPort;
};

/**
 * 创建频道管理动作集合。
 *
 * @param deps - 依赖注入（token 获取、刷新频道、关键状态引用）。
 * @returns 频道管理动作集合。
 */
export function createChannelAdminActions(
  deps: ChannelAdminActionsDeps,
): ChannelAdminActions {
  /**
   * admin 动作的核心职责是“把多个更细粒度的治理子模块拼成一个管理员命令面”。
   *
   * 子模块拆分：
   * - memberActions：成员与管理员角色管理
   * - applicationActions：申请审批
   * - banActions：封禁与解除封禁
   * - channelLifecycleActions：创建/删除频道
   */
  const { api, getSocketAndValidToken, getActiveServerSocket, getActiveScopeVersion, refreshChannels, channelCatalog } = deps;
  const createScopeGuard = createScopeGuardFactory(getActiveServerSocket, getActiveScopeVersion);

  const baseDeps: AdminActionsBaseDeps = { api, getSocketAndValidToken, createScopeGuard };

  return {
    ...createMemberAdminActions(baseDeps),
    ...createApplicationAdminActions(baseDeps),
    ...createBanAdminActions(baseDeps),
    ...createChannelLifecycleAdminActions({
      ...baseDeps,
      refreshChannels,
      channelCatalog,
    }),
  };
}
