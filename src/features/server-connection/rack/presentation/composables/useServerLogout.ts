/**
 * @fileoverview useServerLogout.ts
 * @description server-connection/rack｜composable：从指定服务器退出登录（吊销 token + 清理该 server 的本地会话）。
 *
 * 设计说明：
 * - 退出登录是「按服务器」维度的动作：吊销该 socket 的 refresh token 并清空其本地鉴权/断点续传状态；
 * - 若退出的正是当前活动服务器，则额外清理该 workspace 本地数据、清空当前用户快照，
 *   由调用方在拿到 `activeSessionCleared` 后跳转登录页；
 * - 吊销/清理失败均按 best-effort 处理：本地登录态必须清干净，不能因为服务端不可达而残留。
 */

import { ref, type Ref } from "vue";
import { getAccountCapabilities } from "@/features/account/api";
import { currentServerSocket, getServerConnectionCapabilities } from "@/features/server-connection/api";
import { clearAuthAndResumeState, readRefreshToken } from "@/shared/utils/localState";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("ServerLogout");

export type ServerLogoutOutcome = {
  /** 是否已清理本地登录态。 */
  ok: boolean;
  /** 退出的是当前活动服务器：调用方需要跳转登录页。 */
  activeSessionCleared: boolean;
  /** 失败原因（`ok` 为 `false` 时存在）。 */
  error?: string;
};

export type ServerLogoutModel = {
  /** 是否正在退出登录（用于禁用按钮/展示 loading）。 */
  loggingOut: Ref<boolean>;
  /**
   * 退出指定服务器的登录态。
   *
   * @param serverSocket - 目标服务器 Socket 地址。
   * @returns 退出结果；不抛异常。
   */
  logoutServer(serverSocket: string): Promise<ServerLogoutOutcome>;
};

/**
 * 创建「按服务器退出登录」的展示层模型。
 *
 * @returns 退出登录模型。
 */
export function useServerLogout(): ServerLogoutModel {
  const loggingOut = ref(false);

  async function logoutServer(rawSocket: string): Promise<ServerLogoutOutcome> {
    const socket = String(rawSocket ?? "").trim();
    if (!socket) return { ok: false, activeSessionCleared: false, error: "missing_server_socket" };

    const isActive = socket === currentServerSocket.value.trim();
    loggingOut.value = true;
    try {
      const refreshToken = readRefreshToken(socket);
      if (refreshToken) {
        try {
          await getAccountCapabilities().forServer(socket).revokeToken(refreshToken);
        } catch {
          // best-effort：服务端吊销失败也要继续清理本地登录态
        }
      }

      clearAuthAndResumeState(socket);

      if (isActive) {
        try {
          await getServerConnectionCapabilities().scopeLifecycle.clearCurrentWorkspace(socket);
        } catch {
          // best-effort：workspace 清理失败不阻塞退出
        }
        getAccountCapabilities().currentUser.clearSnapshot();
      }

      logger.info("Action: servers_logout_succeeded", { socket, active: isActive });
      return { ok: true, activeSessionCleared: isActive };
    } catch (error) {
      logger.warn("Action: servers_logout_failed", { socket, error: String(error) });
      return { ok: false, activeSessionCleared: false, error: String(error) };
    } finally {
      loggingOut.value = false;
    }
  }

  return { loggingOut, logoutServer };
}
