/**
 * @fileoverview 频道成员治理动作（成员列表/踢人/设管/撤管）。
 * @description chat/room-governance｜application/admin-actions：members。
 */

import type {
  ChannelMember,
  GrantChannelAdminOutcome,
  KickChannelMemberOutcome,
  RevokeChannelAdminOutcome,
} from "@/features/chat/room-governance/contracts";
import { rejectGovernanceCommand } from "../governanceCommandOutcome";
import { mapApiMember } from "../apiMappers";
import type { AdminActionsBaseDeps } from "./adminActionsContext";

export type MemberAdminActions = {
  listMembers(channelId: string): Promise<ChannelMember[]>;
  kickMember(channelId: string, uid: string): Promise<KickChannelMemberOutcome>;
  setAdmin(channelId: string, uid: string): Promise<GrantChannelAdminOutcome>;
  removeAdmin(channelId: string, uid: string): Promise<RevokeChannelAdminOutcome>;
};

export function createMemberAdminActions(deps: AdminActionsBaseDeps): MemberAdminActions {
  async function listMembers(channelId: string): Promise<ChannelMember[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return [];
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) return [];

    const list = await deps.api.listChannelMembers(socket, token, cid);
    if (isStale()) return [];
    return list.map(mapApiMember);
  }

  async function kickMember(channelId: string, uid: string): Promise<KickChannelMemberOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_member_kicked_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await deps.api.kickChannelMember(socket, token, cid, userId);
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

  async function setAdmin(channelId: string, uid: string): Promise<GrantChannelAdminOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_admin_granted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await deps.api.addChannelAdmin(socket, token, cid, userId);
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

  async function removeAdmin(channelId: string, uid: string): Promise<RevokeChannelAdminOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_admin_revoked_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await deps.api.removeChannelAdmin(socket, token, cid, userId);
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

  return { listMembers, kickMember, setAdmin, removeAdmin };
}
