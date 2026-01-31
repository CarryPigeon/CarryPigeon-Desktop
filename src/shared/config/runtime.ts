/**
 * @fileoverview runtime.ts 文件职责说明。
 */
/**
 * Exported constant.
 * @constant
 */
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";
/**
 * Exported constant.
 * @constant
 */
export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 120);
/**
 * Exported constant.
 * @constant
 */
export const MOCK_SERVER_SOCKET = String(import.meta.env.VITE_MOCK_SERVER_SOCKET ?? "mock://handshake");
