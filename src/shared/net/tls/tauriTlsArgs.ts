/**
 * @fileoverview 桌面端（Tauri）TLS 参数生成工具。
 * @description 网络基础设施：tauriTlsArgs。
 * 桌面端在“自签证书/指纹信任”场景下，需要由 Rust 侧发起请求，才能绕过 WebView 对证书校验的限制。
 *
 * 该文件负责把“机架（rack）里保存的 TLS 策略配置”转换为各类 Tauri command 可复用的参数：
 * - `tlsPolicy`: `"strict" | "insecure" | "trust_fingerprint"`
 * - `tlsFingerprint`: SHA-256 指纹（hex，允许带分隔符；由 Rust 侧归一化）
 */

import { getServerTlsConfig } from "@/shared/net/tls/serverTlsConfigProvider";
import type { ServerTlsConfig } from "@/shared/net/tls/tlsTypes";

/**
 * 桌面端（Tauri）通用 TLS 参数。
 */
export type TauriTlsArgs = { tlsPolicy: ServerTlsConfig["tlsPolicy"]; tlsFingerprint: string };

/**
 * 构造传给 Tauri command 的 TLS 参数（从 rack 配置读取）。
 *
 * @param serverSocket - 服务器 socket key（与 rack 记录匹配）。
 * @returns `tlsPolicy` + `tlsFingerprint`。
 */
export function buildTauriTlsArgs(serverSocket: string): TauriTlsArgs {
  const tls = getServerTlsConfig(serverSocket);
  return { tlsPolicy: tls.tlsPolicy, tlsFingerprint: tls.tlsFingerprint };
}
