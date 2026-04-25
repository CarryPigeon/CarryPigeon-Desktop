/**
 * @fileoverview TLS policy guard helpers.
 * @description Shared policy predicates and fingerprint normalization.
 */

import type { TlsPolicy } from "./tlsTypes";

/**
 * 归一化 TLS 指纹为紧凑 hex（去分隔符、转小写）。
 */
export function normalizeTlsFingerprint(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/[^0-9a-f]/g, "");
}

/**
 * 判断 TLS 指纹是否为有效 SHA-256 hex（64 字符）。
 */
export function isValidTlsFingerprint(raw: string): boolean {
  return normalizeTlsFingerprint(raw).length === 64;
}

/**
 * 校验 TLS 指纹并返回归一化结果。
 */
export function assertValidTlsFingerprint(raw: string): string {
  const fp = normalizeTlsFingerprint(raw);
  if (fp.length !== 64) throw new Error("TLS fingerprint missing/invalid: must be SHA-256 (64 hex chars)");
  return fp;
}

/**
 * 判断 bearer 请求在发布态是否禁止使用 insecure TLS。
 */
export function shouldRejectBearerAuthOverInsecureTls(args: {
  tlsPolicy: TlsPolicy;
  hasBearerToken: boolean;
  isProduction: boolean;
}): boolean {
  return args.isProduction && args.hasBearerToken && args.tlsPolicy === "insecure";
}

/**
 * 判断是否需要由 Tauri 侧执行 HTTPS 请求。
 */
export function shouldUseTauriTlsTransport(args: { tlsPolicy: TlsPolicy; url: string }): boolean {
  try {
    const u = new URL(args.url);
    if (u.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return args.tlsPolicy === "insecure" || args.tlsPolicy === "trust_fingerprint";
}
