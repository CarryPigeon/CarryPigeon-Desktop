/**
 * @fileoverview currentServer.ts
 * @description server-connection/rack｜展示层状态（store）：currentServer。
 */

import { ref } from "vue";
import { MOCK_SERVER_SOCKET } from "@/shared/config/runtime";
import { selectByMockEnabled } from "@/shared/config/mockModeSelector";
import { getServerRackStatePort } from "@/features/server-connection/rack/di/rack.di";
import { resolvePersistedCurrentSocket } from "@/features/server-connection/rack/domain/resolvePersistedCurrentSocket";
import { cleanupAllServerScopes, cleanupServerScope } from "@/shared/utils/serverScopeLifecycle";

/**
 * 由机架列表 store 注入：在当前 socket 变化后把「列表 + 当前选中」一起写入本地。
 *
 * 用回调而不是反向 import `serverList`，避免循环依赖。
 */
let persistCurrentSocketState: (() => void) | null = null;

/**
 * 绑定当前 socket 变化后的持久化函数。
 *
 * @param persist - 将机架列表与当前 socket 写入本地存储。
 */
export function bindCurrentSocketStatePersist(persist: () => void): void {
  persistCurrentSocketState = persist;
}

/**
 * 当前选中的 server socket。
 *
 * 说明：
 * - mock 模式下使用确定性的 mock socket，便于 UI 在无后端环境下直接预览；
 * - 真实模式从本地机架状态恢复，避免刷新或离开 `/chat` 后丢失当前服务器。
 *
 * @constant
 */
export const currentServerSocket = ref<string>(
  selectByMockEnabled(
    () => MOCK_SERVER_SOCKET,
    () => resolvePersistedCurrentSocket(getServerRackStatePort().read()),
  ),
);

/**
 * 更新当前 server socket（写入前会 trim）。
 *
 * 说明：
 * - 这是展示层状态：决定使用哪一套“按 server 隔离”的 store
 *   （例如插件目录/安装状态、聊天 mock 数据等）。
 *
 * @param next - 新的 server socket 字符串。
 */
export function setServerSocket(next: string): void {
  const normalizedNext = next.trim();
  const previous = currentServerSocket.value.trim();
  if (previous === normalizedNext) return;
  currentServerSocket.value = normalizedNext;
  persistCurrentSocketState?.();

  if (!previous) return;
  if (!normalizedNext) {
    cleanupAllServerScopes();
    return;
  }
  cleanupServerScope(previous);
}
