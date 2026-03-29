/**
 * @fileoverview chat session-shared context
 * @description
 * 聚合 session / message-flow / governance 共同依赖、但语义仍属于会话上下文的共享能力：
 * - 当前 server scope 解析；
 * - 频道目录刷新；
 * - 已读状态上报。
 *
 * 说明：
 * - 这里不是通用 service locator，而是“按当前聊天会话共享”的小型上下文；
 * - 之所以单独抽出，是为了避免多个 runtime 重复持有 socket/token/scope 判断逻辑。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import { readAuthToken } from "@/shared/utils/localState";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { getActiveChatServerSocket } from "@/features/chat/integration/serverWorkspace";
import { createChannelData, createReadStateReporter } from "@/features/chat/room-session/internal";
import type { ChatApiGateway } from "./chatGateway";
import type { ChatRuntimeScopePort } from "./chatScopePort";
import type { ChatSessionStateSlice } from "./chatSessionRuntimePorts";

export type ChatSessionSharedContextDeps = {
  api: ChatApiGateway;
  channelsRef: ChatSessionStateSlice["channelsRef"];
  scopeVersion: ChatSessionStateSlice["scopeVersion"];
  lastReadTimeMsByChannel: ChatSessionStateSlice["lastReadTimeMsByChannel"];
  lastReadMidByChannel: ChatSessionStateSlice["lastReadMidByChannel"];
  lastReadReportAtMsByChannel: ChatSessionStateSlice["lastReadReportAtMsByChannel"];
};

export type ChatSessionSharedContext = {
  scope: ChatRuntimeScopePort;
  refreshChannels(): Promise<void>;
  readStateReporter: ChatReadStateReporterPort;
};

function createChatRuntimeScope(scopeVersion: ChatSessionStateSlice["scopeVersion"]): ChatRuntimeScopePort {
  return {
    getActiveServerSocket: () => getActiveChatServerSocket(),
    getActiveScopeVersion: () => scopeVersion.value,
    async getSocketAndValidToken(): Promise<[string, string]> {
      const socket = getActiveChatServerSocket();
      if (!socket) return ["", ""];
      const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
      return [socket, token];
    },
  };
}

export function createChatSessionSharedContext(
  deps: ChatSessionSharedContextDeps,
): ChatSessionSharedContext {
  const scope = createChatRuntimeScope(deps.scopeVersion);

  const readStateReporter = createReadStateReporter({
    api: deps.api,
    scope,
    lastReadTimeMsByChannel: deps.lastReadTimeMsByChannel,
    lastReadMidByChannel: deps.lastReadMidByChannel,
    lastReadReportAtMsByChannel: deps.lastReadReportAtMsByChannel,
  });

  const { refreshChannels } = createChannelData({
    api: deps.api,
    scope,
    channelsRef: deps.channelsRef,
    lastReadTimeMsByChannel: deps.lastReadTimeMsByChannel,
  });

  return {
    scope,
    refreshChannels,
    readStateReporter,
  };
}
