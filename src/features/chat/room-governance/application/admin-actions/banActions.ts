/**
 * @fileoverview 封禁治理动作（列表/设置/解除）。
 * @description chat/room-governance｜application/admin-actions：bans。
 */

import type { ChannelBan, RemoveChannelBanOutcome, SetChannelBanOutcome } from "@/features/chat/room-governance/contracts";
import { rejectGovernanceCommand } from "../governanceCommandOutcome";
import { mapApiBan } from "../apiMappers";
import type { AdminActionsBaseDeps } from "./adminActionsContext";

export type BanAdminActions = {
  listBans(channelId: string): Promise<ChannelBan[]>;
  setBan(channelId: string, uid: string, until: number, reason: string): Promise<SetChannelBanOutcome>;
  removeBan(channelId: string, uid: string): Promise<RemoveChannelBanOutcome>;
};

export function createBanAdminActions(deps: AdminActionsBaseDeps): BanAdminActions {
  async function listBans(channelId: string): Promise<ChannelBan[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return [];
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) return [];

    const list = await deps.api.listChannelBans(socket, token, cid);
    if (isStale()) return [];
    return list.map(mapApiBan);
  }

  async function setBan(channelId: string, uid: string, until: number, reason: string): Promise<SetChannelBanOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_ban_upserted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await deps.api.putChannelBan(socket, token, cid, userId, until, reason);
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

  async function removeBan(channelId: string, uid: string): Promise<RemoveChannelBanOutcome> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "missing_channel_id", "Missing channel id.");
    }
    if (!userId) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "missing_user_id", "Missing user id.", undefined, { channelId: cid });
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_ban_removed_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        uid: userId,
      });
    }

    try {
      await deps.api.deleteChannelBan(socket, token, cid, userId);
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

  return { listBans, setBan, removeBan };
}
