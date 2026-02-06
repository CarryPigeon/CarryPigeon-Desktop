/**
 * @fileoverview serverInfo.ts
 * @description servers｜领域类型：serverInfo。
 */

/**
 * 服务端身份标识：作为客户端侧的隔离命名空间。
 *
 * PRD 约定：
 * `server_id` 必须对同一服务端保持稳定，用于隔离插件安装、缓存与本地存储命名空间。
 */
export type ServerId = string;

/**
 * `/api/server` 接口返回的服务端信息模型（前端领域层）。
 */
export type ServerInfo = {
  /**
   * 服务端返回的稳定标识（通常为 UUID）。
   */
  serverId: ServerId;
  /**
   * 可读的服务端名称。
   */
  name: string;
  /**
   * 服务端简要描述。
   */
  brief: string;
  /**
   * 可选头像 URL/标识（由实现决定）。
   */
  avatar?: string;
  /**
   * 服务端返回的 API 版本字符串（例如 `"1.0"`）。
   */
  apiVersion?: string;
  /**
   * 客户端可接受的最低 API 版本字符串（例如 `"1.0"`）。
   */
  minSupportedApiVersion?: string;
  /**
   * 可选 WS URL（通常形如 `wss://.../api/ws`）。
   */
  wsUrl?: string;
  /**
   * 服务端声明的必装插件 id 列表（用于 required gate 交互）。
   */
  requiredPlugins?: string[];
  /**
   * 可选能力/特性标记（由服务端返回）。
   */
  capabilities?: Record<string, unknown>;
  /**
   * 服务端时间戳（毫秒；可选，主要用于诊断/对时）。
   */
  serverTimeMs?: number;
};
