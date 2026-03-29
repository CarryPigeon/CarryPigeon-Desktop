/**
 * @fileoverview 频道用户治理动作（申请加入/更新频道元信息）。
 * @description chat/room-governance｜application：普通成员路径的频道治理动作编排。
 */

import type { ChatChannelRecord } from "@/features/chat/domain/types/chatApiModels";
import type {
  ApplyJoinChannelOutcome,
  GovernanceChannelSummary,
  UpdateChannelMetaOutcome,
} from "@/features/chat/room-governance/domain/contracts";
import type { GovernanceApiPort, GovernanceChannelCatalogPort } from "../ports";
import { rejectGovernanceCommand } from "../outcomes/governanceCommandOutcome";
import { createScopeGuardFactory } from "../policies/scopeGuard";

export type ChannelUserActionsDeps = {
  api: GovernanceApiPort;
  getSocketAndValidToken: () => Promise<[string, string]>;
  getActiveServerSocket: () => string;
  getActiveScopeVersion: () => number;
  refreshChannels: () => Promise<void>;
  channelCatalog: GovernanceChannelCatalogPort;
};

export type ChannelUserActions = {
  applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
  updateChannelMeta(
    channelId: string,
    patch: Partial<Pick<GovernanceChannelSummary, "name" | "brief">>,
  ): Promise<UpdateChannelMetaOutcome>;
};

export function createChannelUserActions(
  deps: ChannelUserActionsDeps,
): ChannelUserActions {
  const createScopeGuard = createScopeGuardFactory(deps.getActiveServerSocket, deps.getActiveScopeVersion);

  async function applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
    const cid = String(channelId).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_join_applied_rejected", "missing_channel_id", "Missing channel id.");
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_join_applied_rejected", "not_signed_in", "Not signed in.", undefined, { channelId: cid });
    }
    const isStale = createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_join_applied_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
      });
    }

    deps.channelCatalog.setJoinRequested(cid, true);
    try {
      await deps.api.applyJoinChannel(socket, token, cid, "");
      if (isStale()) {
        return rejectGovernanceCommand("channel_join_applied_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      await deps.refreshChannels();
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
        deps.channelCatalog.setJoinRequested(cid, false);
      }
    }
  }

  async function updateChannelMeta(
    channelId: string,
    patch: Partial<Pick<GovernanceChannelSummary, "name" | "brief">>,
  ): Promise<UpdateChannelMetaOutcome> {
    const cid = String(channelId).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_meta_updated_rejected", "missing_channel_id", "Missing channel id.");
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_meta_updated_rejected", "not_signed_in", "Not signed in.", undefined, { channelId: cid });
    }
    const isStale = createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_meta_updated_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
      });
    }

    try {
      const next: ChatChannelRecord = await deps.api.patchChannel(socket, token, cid, { name: patch.name, brief: patch.brief });
      if (isStale()) {
        return rejectGovernanceCommand("channel_meta_updated_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      deps.channelCatalog.applyChannelPatch(cid, {
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

  return { applyJoin, updateChannelMeta };
}
