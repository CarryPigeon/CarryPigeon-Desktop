/**
 * @fileoverview room-governance application service。
 * @description
 * 把普通成员路径与管理员路径统一收束到一个 application service。
 *
 * 这个对象统一表达 room-governance 的应用层语义：
 * - 普通成员命令：申请加入、修改频道元信息
 * - 管理员命令：成员、申请、封禁、频道生命周期治理
 * - 治理查询：成员/申请/封禁列表
 */

import type { ChatChannelRecord } from "@/features/chat/domain/types/chatApiModels";
import type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  CreateChannelOutcome,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GovernanceChannelSummary,
  GrantChannelAdminOutcome,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "@/features/chat/room-governance/domain/contracts";
import { mapApiApplication, mapApiBan, mapApiChannel, mapApiMember } from "../mappers/apiMappers";
import { rejectGovernanceCommand } from "../outcomes/governanceCommandOutcome";
import type { GovernanceApiPort, GovernanceChannelCatalogPort } from "../ports";
import { createScopeGuardFactory } from "../policies/scopeGuard";

/**
 * `RoomGovernanceApplicationService` 的依赖集合。
 */
export type RoomGovernanceApplicationServiceDeps = {
  api: GovernanceApiPort;
  getSocketAndValidToken: () => Promise<[string, string]>;
  getActiveServerSocket: () => string;
  getActiveScopeVersion: () => number;
  refreshChannels: () => Promise<void>;
  channelCatalog: GovernanceChannelCatalogPort;
};

/**
 * room-governance 子域唯一的 application service。
 *
 * 约束：
 * - 只依赖显式端口；
 * - 只返回显式 Outcome 或稳定查询结果；
 * - 不直接触碰 presentation 响应式对象。
 */
export class RoomGovernanceApplicationService {
  constructor(private readonly deps: RoomGovernanceApplicationServiceDeps) {}

  /**
   * 申请加入某个频道。
   */
  async applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
    const cid = String(channelId).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_join_applied_rejected", "missing_channel_id", "Missing channel id.");
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_join_applied_rejected", "not_signed_in", "Not signed in.", undefined, { channelId: cid });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_join_applied_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
      });
    }

    this.deps.channelCatalog.setJoinRequested(cid, true);
    try {
      await this.deps.api.applyJoinChannel(socket, token, cid, "");
      if (isStale()) {
        return rejectGovernanceCommand("channel_join_applied_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      await this.deps.refreshChannels();
      return {
        ok: true,
        kind: "channel_join_applied",
        channelId: cid,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_join_applied_rejected", "governance_action_failed", "Failed to apply channel join.", error, {
        channelId: cid,
      });
    } finally {
      if (!isStale()) {
        this.deps.channelCatalog.setJoinRequested(cid, false);
      }
    }
  }

  /**
   * 更新频道名称或简介。
   *
   * 成功后只做局部目录投影同步，不主动重建整份目录。
   */
  async updateChannelMeta(
    channelId: string,
    patch: Partial<Pick<GovernanceChannelSummary, "name" | "brief">>,
  ): Promise<UpdateChannelMetaOutcome> {
    const cid = String(channelId).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_meta_updated_rejected", "missing_channel_id", "Missing channel id.");
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_meta_updated_rejected", "not_signed_in", "Not signed in.", undefined, { channelId: cid });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_meta_updated_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
      });
    }

    try {
      const next: ChatChannelRecord = await this.deps.api.patchChannel(socket, token, cid, { name: patch.name, brief: patch.brief });
      if (isStale()) {
        return rejectGovernanceCommand("channel_meta_updated_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      this.deps.channelCatalog.applyChannelPatch(cid, {
        name: typeof next.name === "string" ? next.name.trim() : undefined,
        brief: typeof next.brief === "string" ? String(next.brief ?? "").trim() : undefined,
      });
      return {
        ok: true,
        kind: "channel_meta_updated",
        channelId: cid,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_meta_updated_rejected", "governance_action_failed", "Failed to update channel metadata.", error, {
        channelId: cid,
      });
    }
  }

  /**
   * 查询频道成员列表。
   */
  async listMembers(channelId: string): Promise<ChannelMember[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) return [];
    const isStale = this.createScopeGuard(socket);
    if (isStale()) return [];

    const list = await this.deps.api.listChannelMembers(socket, token, cid);
    if (isStale()) return [];
    return list.map(mapApiMember);
  }

  /**
   * 将某个成员移出频道。
   */
  async kickMember(channelId: string, uid: string): Promise<KickChannelMemberOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await this.deps.api.kickChannelMember(socket, token, cid, userId);
      if (isStale()) {
        return rejectGovernanceCommand("channel_member_kicked_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
          uid: userId,
        });
      }
      return {
        ok: true,
        kind: "channel_member_kicked",
        channelId: cid,
        uid: userId,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "governance_action_failed", "Failed to kick member.", error, {
        channelId: cid,
        uid: userId,
      });
    }
  }

  /**
   * 将某个成员设为管理员。
   */
  async setAdmin(channelId: string, uid: string): Promise<GrantChannelAdminOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await this.deps.api.addChannelAdmin(socket, token, cid, userId);
      if (isStale()) {
        return rejectGovernanceCommand("channel_admin_granted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
          uid: userId,
        });
      }
      return {
        ok: true,
        kind: "channel_admin_granted",
        channelId: cid,
        uid: userId,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "governance_action_failed", "Failed to grant channel admin.", error, {
        channelId: cid,
        uid: userId,
      });
    }
  }

  /**
   * 撤销某个管理员身份。
   */
  async removeAdmin(channelId: string, uid: string): Promise<RevokeChannelAdminOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await this.deps.api.removeChannelAdmin(socket, token, cid, userId);
      if (isStale()) {
        return rejectGovernanceCommand("channel_admin_revoked_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
          uid: userId,
        });
      }
      return {
        ok: true,
        kind: "channel_admin_revoked",
        channelId: cid,
        uid: userId,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "governance_action_failed", "Failed to revoke channel admin.", error, {
        channelId: cid,
        uid: userId,
      });
    }
  }

  /**
   * 查询频道入群申请列表。
   */
  async listApplications(channelId: string): Promise<ChannelApplication[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) return [];
    const isStale = this.createScopeGuard(socket);
    if (isStale()) return [];

    const list = await this.deps.api.listChannelApplications(socket, token, cid);
    if (isStale()) return [];
    return list.map(mapApiApplication);
  }

  /**
   * 审批一条入群申请。
   */
  async decideApplication(
    channelId: string,
    applicationId: string,
    approved: boolean,
  ): Promise<DecideChannelApplicationOutcome> {
    const cid = String(channelId).trim();
    const aid = String(applicationId).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_application_decided_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!aid) {
      return rejectGovernanceCommand("channel_application_decided_rejected", "missing_application_id", "Missing application id.", undefined, {
        channelId: cid,
      });
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_application_decided_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        applicationId: aid,
      });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_application_decided_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        applicationId: aid,
      });
    }

    const decision = approved ? "approve" : "reject";
    try {
      await this.deps.api.decideChannelApplication(socket, token, cid, aid, decision);
      if (isStale()) {
        return rejectGovernanceCommand("channel_application_decided_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
          applicationId: aid,
        });
      }
      return {
        ok: true,
        kind: "channel_application_decided",
        channelId: cid,
        applicationId: aid,
        decision,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_application_decided_rejected", "governance_action_failed", "Failed to decide channel application.", error, {
        channelId: cid,
        applicationId: aid,
        decision,
      });
    }
  }

  /**
   * 查询频道封禁列表。
   */
  async listBans(channelId: string): Promise<ChannelBan[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) return [];
    const isStale = this.createScopeGuard(socket);
    if (isStale()) return [];

    const list = await this.deps.api.listChannelBans(socket, token, cid);
    if (isStale()) return [];
    return list.map(mapApiBan);
  }

  /**
   * 设置或覆盖一条封禁记录。
   */
  async setBan(channelId: string, uid: string, until: number, reason: string): Promise<SetChannelBanOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await this.deps.api.putChannelBan(socket, token, cid, userId, until, reason);
      if (isStale()) {
        return rejectGovernanceCommand("channel_ban_upserted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
          uid: userId,
        });
      }
      return {
        ok: true,
        kind: "channel_ban_upserted",
        channelId: cid,
        uid: userId,
        until,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "governance_action_failed", "Failed to set channel ban.", error, {
        channelId: cid,
        uid: userId,
        until,
      });
    }
  }

  /**
   * 删除一条封禁记录。
   */
  async removeBan(channelId: string, uid: string): Promise<RemoveChannelBanOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await this.deps.api.deleteChannelBan(socket, token, cid, userId);
      if (isStale()) {
        return rejectGovernanceCommand("channel_ban_removed_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
          uid: userId,
        });
      }
      return {
        ok: true,
        kind: "channel_ban_removed",
        channelId: cid,
        uid: userId,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "governance_action_failed", "Failed to remove channel ban.", error, {
        channelId: cid,
        uid: userId,
      });
    }
  }

  /**
   * 创建频道，并在成功后刷新目录。
   */
  async createChannel(name: string, brief?: string): Promise<CreateChannelOutcome> {
    const channelName = String(name ?? "").trim();
    if (!channelName) {
      return rejectGovernanceCommand("channel_created_rejected", "missing_channel_name", "Channel name is required.");
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_created_rejected", "not_signed_in", "Not signed in.");
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_created_rejected", "stale_runtime_scope", "Governance runtime scope changed.");
    }

    try {
      const created = await this.deps.api.createChannel(socket, token, { name: channelName, brief });
      if (isStale()) {
        return rejectGovernanceCommand("channel_created_rejected", "stale_runtime_scope", "Governance runtime scope changed.");
      }
      await this.deps.refreshChannels();
      if (isStale()) {
        return rejectGovernanceCommand("channel_created_rejected", "stale_runtime_scope", "Governance runtime scope changed.");
      }
      return {
        ok: true,
        kind: "channel_created",
        channel: mapApiChannel(created),
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_created_rejected", "governance_action_failed", "Failed to create channel.", error, {
        channelName,
      });
    }
  }

  /**
   * 删除频道，并在成功后刷新目录与修正当前选中频道。
   */
  async deleteChannel(channelId: string): Promise<DeleteChannelOutcome> {
    const cid = String(channelId).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_deleted_rejected", "missing_channel_id", "Missing channel id.");
    }
    const [socket, token] = await this.deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_deleted_rejected", "not_signed_in", "Not signed in.", undefined, { channelId: cid });
    }
    const isStale = this.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_deleted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
      });
    }

    try {
      await this.deps.api.deleteChannel(socket, token, cid);
      if (isStale()) {
        return rejectGovernanceCommand("channel_deleted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      await this.deps.refreshChannels();
      if (isStale()) {
        return rejectGovernanceCommand("channel_deleted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      this.deps.channelCatalog.reconcileSelectionAfterDeletion(cid);
      return {
        ok: true,
        kind: "channel_deleted",
        channelId: cid,
      };
    } catch (error) {
      return rejectGovernanceCommand("channel_deleted_rejected", "governance_action_failed", "Failed to delete channel.", error, {
        channelId: cid,
      });
    }
  }

  /**
   * 为某次请求固定一个 scope 守卫。
   */
  private createScopeGuard(socket: string): () => boolean {
    return createScopeGuardFactory(this.deps.getActiveServerSocket, this.deps.getActiveScopeVersion)(socket);
  }
}
