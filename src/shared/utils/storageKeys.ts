/**
 * @fileoverview localStorage key 约定集合（统一前缀与常量）。
 * @description 通用工具：storageKeys。
 * 统一管理 localStorage key 的前缀与固定键名，避免散落硬编码字符串导致：
 * - 清理/迁移遗漏
 * - key 拼写不一致
 * - 多处复制粘贴带来维护成本
 */

/**
 * @constant
 * @description 按 server scope（server_id 优先）隔离的 access token key 前缀。
 */
export const KEY_AUTH_TOKEN_PREFIX = "carrypigeon:authToken:";

/**
 * @constant
 * @description 按 server scope（server_id 优先）隔离的 auth session key 前缀。
 */
export const KEY_AUTH_SESSION_PREFIX = "carrypigeon:authSession:";

/**
 * @constant
 * @description 按 server scope（server_id 优先）隔离的 WS resume 游标 key 前缀。
 */
export const KEY_LAST_EVENT_ID_PREFIX = "carrypigeon:lastEventId:";

/**
 * @constant
 * @description 本地已知最新消息时间戳 key（全局）。
 */
export const KEY_LATEST_MESSAGE_TIME_MS = "carrypigeon:latestMessageTimeMs";

/**
 * @constant
 * @description 原始 app config JSON key（全局）。
 */
export const KEY_APP_CONFIG_RAW = "carrypigeon:appConfigRaw";

/**
 * @constant
 * @description 主题持久化 key（全局）。
 */
export const KEY_THEME = "carrypigeon:theme";

/**
 * @constant
 * @description 稳定 device id key（全局）。
 */
export const KEY_DEVICE_ID = "carrypigeon:deviceId";

/**
 * @constant
 * @description server_socket → server_id 映射表 key（全局）。
 */
export const KEY_SERVER_ID_BY_SOCKET = "carrypigeon:serverIdBySocket:v1";

/**
 * @constant
 * @description 插件 repo sources 持久化 key（全局）。
 */
export const KEY_REPO_SOURCES = "carrypigeon:repoSources:v1";
