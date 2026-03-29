/**
 * @fileoverview 入群申请治理动作（列表/审批）。
 * @description chat/room-governance｜application/usecases/admin-actions：applications。
 */

import type { ChannelApplication, DecideChannelApplicationOutcome } from "@/features/chat/room-governance/domain/contracts";
import { rejectGovernanceCommand } from "../../outcomes/governanceCommandOutcome";
import { mapApiApplication } from "../../mappers/apiMappers";
import type { AdminActionsBaseDeps } from "./adminActionsContext";

export type ApplicationAdminActions = {
  listApplications(channelId: string): Promise<ChannelApplication[]>;
  decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<DecideChannelApplicationOutcome>;
};

export function createApplicationAdminActions(deps: AdminActionsBaseDeps): ApplicationAdminActions {
  async function listApplications(channelId: string): Promise<ChannelApplication[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return [];
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) return [];

    const list = await deps.api.listChannelApplications(socket, token, cid);
    if (isStale()) return [];
    return list.map(mapApiApplication);
  }

  async function decideApplication(
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
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectGovernanceCommand("channel_application_decided_rejected", "not_signed_in", "Not signed in.", undefined, {
        channelId: cid,
        applicationId: aid,
      });
    }
    const isStale = deps.createScopeGuard(socket);
    if (isStale()) {
      return rejectGovernanceCommand("channel_application_decided_rejected", "stale_runtime_scope", "Governance runtime scope changed.", undefined, {
        channelId: cid,
        applicationId: aid,
      });
    }

    const decision = approved ? "approve" : "reject";
    try {
      await deps.api.decideChannelApplication(socket, token, cid, aid, decision);
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

  return { listApplications, decideApplication };
}
