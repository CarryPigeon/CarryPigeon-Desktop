/**
 * @fileoverview Server TLS 配置 provider（依赖倒置）。
 * @description
 * 背景：
 * - `shared/net/*` 属于基础设施层，不应直接依赖任何 feature 的 presentation/store；
 * - 但 HTTP/Tauri 请求在“自签/指纹信任”场景下需要读取 per-server TLS 策略；
 * - 因此通过 provider 注入的方式实现依赖倒置：由上层（feature）注册 provider，shared 仅消费。
 */

import type { ServerTlsConfig } from "./tlsTypes";

/**
 * 默认 TLS 配置（不依赖任何外部状态）。
 */
const DEFAULT_TLS: ServerTlsConfig = { tlsPolicy: "strict", tlsFingerprint: "" };

/**
 * TLS 配置获取函数（由上层注入）。
 */
export type ServerTlsConfigProvider = (serverSocket: string) => ServerTlsConfig;

let provider: ServerTlsConfigProvider | null = null;

/**
 * 注册 TLS 配置 provider。
 *
 * 说明：
 * - 允许重复调用，后注册者覆盖前者；
 * - 推荐在 servers 模块初始化时注册（例如 serverList store 模块加载时）。
 *
 * @param next - provider 函数。
 */
export function setServerTlsConfigProvider(next: ServerTlsConfigProvider): void {
  provider = next;
}

/**
 * 获取指定 socket 的 TLS 配置（若未注册 provider 则返回默认 strict）。
 *
 * @param serverSocket - 服务器 socket。
 * @returns TLS 配置。
 */
export function getServerTlsConfig(serverSocket: string): ServerTlsConfig {
  try {
    return provider ? provider(serverSocket) : DEFAULT_TLS;
  } catch {
    return DEFAULT_TLS;
  }
}

