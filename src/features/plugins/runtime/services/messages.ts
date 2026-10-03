/**
 * @fileoverview plugins 运行时能力服务：messages。
 * @description
 * 组装只读当前频道能力（`messages:read`）与发言能力（`messages:send`）。
 * 即使服务可见，方法内部仍按权限二次校验（可见性之外的双重防御）。
 */

import type {
  PluginChannelHistoryLoadResult,
  PluginComposerPayload,
  PluginCurrentChannelMessagesSnapshot,
  PluginMessagesApi,
} from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";
import { createLogger } from "@/shared/utils/logger";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginMessagesService } from "../types";

const logger = createLogger("plugin-messages-service");

/** 未选择频道 / 无法读取时的空快照（形状与宿主契约一致）。 */
function emptyChannelMessagesSnapshot(): PluginCurrentChannelMessagesSnapshot {
  return {
    channelId: "",
    channelName: "",
    totalCount: 0,
    truncated: false,
    hasMoreHistory: false,
    capturedAtMs: 0,
    messages: [],
    selectedMessageIds: [],
    selectedTotalCount: 0,
  };
}

/** 无翻页发生时的零增量结果。 */
function emptyHistoryLoadResult(): PluginChannelHistoryLoadResult {
  return { loadedCount: 0, loadedDelta: 0, hasMore: false };
}

export type MessagesServiceOptions = {
  pluginId: string;
  permissions: ReadonlySet<string>;
  /** chat feature 提供的只读读取桥（`messages:read` 门控）。 */
  reader?: PluginMessagesApi;
  /** 宿主发送桥（`messages:send` 门控）。 */
  send?: (payload: PluginComposerPayload) => Promise<void>;
  guard: RuntimeGuard;
};

/**
 * 创建频道消息能力服务（读 + 发）。
 */
export function createMessagesService(options: MessagesServiceOptions): PluginMessagesService {
  const { pluginId, permissions, reader, send, guard } = options;
  const canRead = permissions.has("messages:read");
  const canSend = permissions.has("messages:send");
  return {
    async readCurrentChannel(input) {
      if (isGuardDisposed(guard, "messages.readCurrentChannel", pluginId) || !canRead || !reader) {
        return emptyChannelMessagesSnapshot();
      }
      const maxMessages = Number(input?.maxMessages);
      try {
        return await reader.readCurrentChannel(
          Number.isFinite(maxMessages) ? { maxMessages } : undefined,
        );
      } catch (error) {
        logger.warn("Action: plugins_messages_read_failed", { pluginId, error: String(error) });
        return emptyChannelMessagesSnapshot();
      }
    },
    async loadMoreHistory() {
      if (isGuardDisposed(guard, "messages.loadMoreHistory", pluginId) || !canRead || !reader) {
        return emptyHistoryLoadResult();
      }
      try {
        return await reader.loadMoreHistory();
      } catch (error) {
        logger.warn("Action: plugins_messages_load_more_failed", { pluginId, error: String(error) });
        return emptyHistoryLoadResult();
      }
    },
    async send(payload: PluginComposerPayload): Promise<void> {
      if (isGuardDisposed(guard, "messages.send", pluginId)) return;
      if (!canSend) {
        throw createPluginRuntimeError(
          "plugin_permission_denied",
          `plugin ${pluginId} lacks "messages:send" permission`,
          { pluginId, command: "messages.send" },
        );
      }
      if (!send) {
        throw createPluginRuntimeError(
          "missing_plugin_host_bridge",
          `plugin ${pluginId} host send bridge not provided`,
          { pluginId },
        );
      }
      await send(payload);
    },
  };
}
