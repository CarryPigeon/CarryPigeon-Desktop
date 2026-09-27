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
 * 判断是否需要由 Tauri(Rust reqwest) 侧执行 HTTP(S) 请求。
 *
 * 背景：
 * - 自签证书/指纹信任场景下 WebView `fetch` 无法绕过证书校验，必须走 Rust；
 * - release 桌面构建中 WebView origin（如 `http://tauri.localhost`）直连服务器属于跨域，
 *   JSON POST 会触发 CORS 预检；自托管服务端通常不处理预检，导致登录等写请求在
 *   release 中失败（dev 环境被 Vite 同源代理掩盖）。
 * - reqwest 不受 WebView CORS 约束，因此在 Tauri 运行时内统一走 Rust 通道；
 *   仅浏览器预览（无 Tauri bridge）回退到 `fetch`。
 */
export function shouldUseTauriHttpTransport(args: { url: string; isTauriRuntime: boolean }): boolean {
  if (!args.isTauriRuntime) return false;
  try {
    const u = new URL(args.url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
