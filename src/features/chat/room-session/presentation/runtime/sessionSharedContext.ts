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

import type { ChatReadStateReporterPort } from "@/features/chat/domain/ports/runtimePorts";
import { readAuthToken } from "@/shared/utils/localState";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { getActiveChatServerSocket } from "@/features/chat/data/server-workspace/chatServerWorkspaceAdapter";
import { createReadStateReporter, RoomSessionCatalogApplicationService } from "@/features/chat/room-session/internal";
import type { ChatApiGateway } from "@/features/chat/composition/contracts/chatGateway";
import type { ChatRuntimeScopePort } from "@/features/chat/composition/contracts/chatScopePort";
import type { ChatSessionStateSlice } from "./sessionRuntimePorts";
import {
  createSessionDirectoryStatePort,
  createSessionReadMarkerStatePort,
} from "./sessionStateAdapters";

/**
 * 会话共享上下文装配依赖。
 */
export type ChatSessionSharedContextDeps = {
  api: ChatApiGateway;
  channelsRef: ChatSessionStateSlice["channelsRef"];
  scopeVersion: ChatSessionStateSlice["scopeVersion"];
  lastReadTimeMsByChannel: ChatSessionStateSlice["lastReadTimeMsByChannel"];
  lastReadMidByChannel: ChatSessionStateSlice["lastReadMidByChannel"];
  lastReadReportAtMsByChannel: ChatSessionStateSlice["lastReadReportAtMsByChannel"];
};

/**
 * session / message-flow / governance 共享的会话上下文。
 */
export type ChatSessionSharedContext = {
  /**
   * 当前 chat runtime 的作用域上下文。
   */
  scope: ChatRuntimeScopePort;
  /**
   * 刷新频道目录。
   *
   * 谁会调用：
   * - ensure-ready
   * - governance 动作后的目录同步
   * - catch-up / reconnect 之后的目录重取
   */
  refreshChannels(): Promise<void>;
  /**
   * 已读状态推进与限流上报器。
   */
  readStateReporter: ChatReadStateReporterPort;
};

/**
 * 创建 chat runtime 共享的 scope 协议。
 *
 * 这个对象不是通用上下文容器，而是 chat 当前会话的最小运行时边界：
 * - 当前 socket 是谁
 * - 当前 scope 是否已经切换
 * - 当前是否拿得到有效 token
 */
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

/**
 * 组装 session / message-flow / governance 共用的会话基础设施。
 *
 * 读取建议：
 * - 想知道三个子运行时共享什么，先看这里；
 * - 想知道各自的差异能力，再看 `sessionRuntime.ts` / `messageFlowRuntime.ts` / `governanceRuntime.ts`。
 */
export function createChatSessionSharedContext(
  deps: ChatSessionSharedContextDeps,
): ChatSessionSharedContext {
  const scope = createChatRuntimeScope(deps.scopeVersion);
  const directoryState = createSessionDirectoryStatePort({
    channelsRef: deps.channelsRef,
  });
  const readMarkerState = createSessionReadMarkerStatePort({
    lastReadTimeMsByChannel: deps.lastReadTimeMsByChannel,
    lastReadMidByChannel: deps.lastReadMidByChannel,
    lastReadReportAtMsByChannel: deps.lastReadReportAtMsByChannel,
  });

  const readStateReporter = createReadStateReporter({
    api: deps.api,
    scope,
    state: readMarkerState,
  });

  /**
   * 目录刷新逻辑统一下沉到 application service，
   * shared context 只负责把 scope 与状态端口装配进去。
   */
  const catalogApplicationService = new RoomSessionCatalogApplicationService({
    api: deps.api,
    scope,
    directoryState,
    readMarkerState,
  });

  return {
    scope,
    refreshChannels: () => catalogApplicationService.refreshChannels(),
    readStateReporter,
  };
}
