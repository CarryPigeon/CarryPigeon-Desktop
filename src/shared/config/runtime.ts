/**
 * @fileoverview 运行时配置（Vite env → 强类型常量）。
 *
 * 该模块将 `import.meta.env` 的字符串配置转换为全局可用的强类型值。
 * 将环境变量解析集中到一处，可避免在各 feature 中散落解析逻辑。
 */
/**
 * 是否启用本地 mock 实现（用于 UI 预览）。
 *
 * 建议用于本地 UI 开发：`VITE_USE_MOCK_API=true`。
 *
 * @constant
 */
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";

/**
 * mock 模式枚举。
 */
export type MockMode = "off" | "store" | "protocol";

/**
 * 模拟（mock）模式选择器。
 *
 * - `"store"`：feature 内 mock ports/stores（旧行为，更适合浏览器 UI 预览）
 * - `"protocol"`：基于协议的 mock HTTP+WS transport（更适合集成测试）
 *
 * 规则：
 * - 当 `VITE_USE_MOCK_API=false` 时，无论 `VITE_MOCK_MODE` 如何，都为 `"off"`。
 * - 当 `VITE_USE_MOCK_API=true` 且 `VITE_MOCK_MODE` 未设置时，默认 `"store"`。
 *
 * @constant
 */
export const MOCK_MODE: MockMode = (() => {
  if (!USE_MOCK_API) return "off";
  const raw = String(import.meta.env.VITE_MOCK_MODE ?? "").trim().toLowerCase();
  if (raw === "protocol") return "protocol";
  return "store";
})();

/**
 * 是否启用任意 mock 模式（store 或 protocol）。
 *
 * @constant
 */
export const IS_MOCK_ENABLED = MOCK_MODE !== "off";

/**
 * 是否处于 store mock 模式。
 *
 * @constant
 */
export const IS_STORE_MOCK = MOCK_MODE === "store";

/**
 * 是否处于 protocol mock 模式。
 *
 * @constant
 */
export const IS_PROTOCOL_MOCK = MOCK_MODE === "protocol";

/**
 * 是否使用协议级 mock transport（HTTP+WS）替代真实网络。
 *
 * @constant
 */
export const USE_MOCK_TRANSPORT = IS_PROTOCOL_MOCK;
/**
 * 模拟（mock）延迟（毫秒）：用于模拟网络耗时。
 *
 * @constant
 */
export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 120);
/**
 * 模拟（mock）模式启用时使用的默认 server socket。
 *
 * @constant
 */
export const MOCK_SERVER_SOCKET = String(import.meta.env.VITE_MOCK_SERVER_SOCKET ?? "mock://handshake");
