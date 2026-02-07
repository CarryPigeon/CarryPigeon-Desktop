/**
 * @fileoverview currentServer.ts
 * @description servers｜展示层状态（store）：currentServer。
 */

import { ref } from "vue";
import { MOCK_SERVER_SOCKET } from "@/shared/config/runtime";
import { selectByMockEnabled } from "@/shared/config/mockModeSelector";

/**
 * 当前选中的 server socket。
 *
 * 说明：
 * - mock 模式下使用确定性的 mock socket，便于 UI 在无后端环境下直接预览。
 *
 * @constant
 */
export const currentServerSocket = ref<string>(selectByMockEnabled(() => MOCK_SERVER_SOCKET, () => ""));

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
  currentServerSocket.value = next.trim();
}
