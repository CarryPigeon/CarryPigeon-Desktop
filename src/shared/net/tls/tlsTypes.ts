/**
 * @fileoverview TLS 类型定义（跨模块共享）。
 * @description
 * - 该文件仅提供类型与约定，不引入任何 feature 依赖；
 * - 供 HTTP/TCP/Tauri 等多处统一使用，避免类型在各 feature 内重复定义导致漂移。
 */

/**
 * TLS 策略（与 Rust 侧保持一致）。
 */
export type TlsPolicy = "strict" | "insecure" | "trust_fingerprint";

/**
 * 按 server socket 隔离的 TLS 配置。
 */
export type ServerTlsConfig = {
  tlsPolicy: TlsPolicy;
  tlsFingerprint: string;
};

