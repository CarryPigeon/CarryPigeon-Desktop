/**
 * @fileoverview 频道生命周期治理动作（创建/删除）。
 * @description chat/room-governance｜application/admin-actions：channel-lifecycle。
 */

import type {
  CreateChannelOutcome,
  DeleteChannelOutcome,
} from "@/features/chat/room-governance/contracts";
import { mapApiChannel } from "../apiMappers";
import type { AdminActionsBaseDeps } from "./adminActionsContext";
import { rejectGovernanceCommand } from "../governanceCommandOutcome";
import type { GovernanceChannelCatalogPort } from "../ports";

export type ChannelLifecycleAdminActions = {
  createChannel(name: string, brief?: string): Promise<CreateChannelOutcome>;
  deleteChannel(channelId: string): Promise<DeleteChannelOutcome>;
};

export type ChannelLifecycleAdminDeps = AdminActionsBaseDeps & {
  /**
   * 刷新频道目录，确保治理动作后的目录状态与服务端对齐。
   */
  refreshChannels: () => Promise<void>;
  /**
   * 频道目录同步端口（删除后的当前频道校正等）。
   */
  channelCatalog: GovernanceChannelCatalogPort;
};

export function createChannelLifecycleAdminActions(
  deps: ChannelLifecycleAdminDeps,
): ChannelLifecycleAdminActions {
  async function createChannel(name: string, brief?: string): Promise<CreateChannelOutcome> {
    const channelName = String(name ?? "").trim();
    if (!channelName) {
      return rejectGovernanceCommand("channel_created_rejected", "missing_channel_name", "Channel name is required.");
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_created_rejected", "not_signed_in", "Not signed in.");
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_created_rejected", "stale_runtime_scope", "Governance runtime scope changed.");
    }

    try {
      const created = await deps.api.createChannel(socket, token, { name: channelName, brief });
      if (isStale()) {
        return rejectGovernanceCommand("channel_created_rejected", "stale_runtime_scope", "Governance runtime scope changed.");
      }
      await deps.refreshChannels();
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

  async function deleteChannel(channelId: string): Promise<DeleteChannelOutcome> {
    const cid = String(channelId).trim();
    if (!cid) {
      return rejectGovernanceCommand("channel_deleted_rejected", "missing_channel_id", "Missing channel id.");
    }
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_deleted_rejected", "not_signed_in", "Not signed in.", undefined, { channelId: cid });
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_deleted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
      });
    }

    try {
      await deps.api.deleteChannel(socket, token, cid);
      if (isStale()) {
        return rejectGovernanceCommand("channel_deleted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      await deps.refreshChannels();
      if (isStale()) {
        return rejectGovernanceCommand("channel_deleted_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
          channelId: cid,
        });
      }
      deps.channelCatalog.reconcileSelectionAfterDeletion(cid);
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

  return { createChannel, deleteChannel };
}
