/**
 * @fileoverview audit-logs capability source。
 */

import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { readAuthToken } from "@/shared/utils/localState";
import { createHttpAuditLogApi } from "./data/httpAuditLogApi";
import type { ChatAuditLogCapabilities } from "./api-types";

async function getSocketAndValidToken(): Promise<[string | null, string | null]> {
  const socket = getActiveChatServerSocket().trim();
  if (!socket) return [null, null];
  const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
  if (!token) return [null, null];
  return [socket, token];
}

/**
 * 创建审计日志 capability。
 */
export function createAuditLogCapabilitySource(): ChatAuditLogCapabilities {
  const api = createHttpAuditLogApi();
  return {
    async listAuditLogs(query) {
      const [socket, token] = await getSocketAndValidToken();
      if (!socket || !token) throw new Error("Not signed in.");
      return api.listAuditLogs(socket, token, query);
    },
  };
}
