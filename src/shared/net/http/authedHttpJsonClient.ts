/**
 * @fileoverview 鉴权 HTTP JSON 客户端工厂。
 * @description 网络基础设施：authedHttpJsonClient。
 *
 * 背景：
 * - 多个 feature 的 data adapter 需要创建“绑定 server socket + bearer token”的 `HttpJsonClient`。
 * - 为避免重复的 trim/校验/版本归一化逻辑，将构造过程收敛到此处，便于统一演进与排错。
 *
 * 约定：
 * - 该模块只负责“构造客户端”，不负责 token 刷新与重试策略。
 * - 抛出的错误信息保持英文，便于日志与错误上报侧统一聚合。
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";

/**
 * 创建鉴权客户端的可选参数。
 */
export type CreateAuthedHttpJsonClientOptions = {
  /**
   * API 主版本号（写入 `Accept` 头）。
   *
   * 说明：
   * - 默认值为 1；非数字/小于 1 会被归一化为 1。
   */
  apiVersion?: number;
};

/**
 * 创建绑定到指定 server socket 与 access token 的鉴权 HTTP JSON 客户端。
 *
 * @param serverSocket - 服务端 socket（origin 输入）。
 * @param accessToken - Bearer access token。
 * @param options - 可选配置（例如 `apiVersion`）。
 * @returns `HttpJsonClient` 实例。
 * @throws 当 socket 或 token 为空时抛出错误。
 */
export function createAuthedHttpJsonClient(
  serverSocket: string,
  accessToken: string,
  options?: CreateAuthedHttpJsonClientOptions,
): HttpJsonClient {
  const socket = String(serverSocket ?? "").trim();
  const token = String(accessToken ?? "").trim();
  if (!socket) throw new Error("Missing server socket");
  if (!token) throw new Error("Missing access token");

  const apiVersion = Number(options?.apiVersion ?? 1);
  const normalizedApiVersion = Number.isFinite(apiVersion) ? Math.max(1, Math.trunc(apiVersion)) : 1;

  return new HttpJsonClient({ serverSocket: socket, apiVersion: normalizedApiVersion, accessToken: token });
}

