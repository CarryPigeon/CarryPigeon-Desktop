/**
 * @fileoverview serverInfo.ts
 * @description Domain types for server identity and basic info (`server_id`, name, brief, avatar).
 */

/**
 * Server identity used as the isolation namespace across the client.
 *
 * PRD: `server_id` must be stable for a server and is used to isolate
 * plugin installs, caches and local storage.
 */
export type ServerId = string;

export type ServerInfo = {
  /**
   * Stable server UUID returned by the server.
   */
  serverId: ServerId;
  /**
   * Human-readable server name.
   */
  name: string;
  /**
   * Short server brief/description.
   */
  brief: string;
  /**
   * Optional avatar URL or identifier (implementation-defined).
   */
  avatar?: string;
  /**
   * API version string returned by the server (e.g. `"1.0"`).
   */
  apiVersion?: string;
  /**
   * Minimum supported API version string (e.g. `"1.0"`).
   */
  minSupportedApiVersion?: string;
  /**
   * Optional WS URL returned by the server (typically `wss://.../api/ws`).
   */
  wsUrl?: string;
  /**
   * Required plugin ids declared by the server (used for required gate UX).
   */
  requiredPlugins?: string[];
  /**
   * Optional capability flags/metadata returned by the server.
   */
  capabilities?: Record<string, unknown>;
  /**
   * Server time in milliseconds (optional; used for diagnostics).
   */
  serverTimeMs?: number;
};
