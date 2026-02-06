/**
 * @fileoverview servers Feature 对外公共 API（跨 Feature 访问边界）。
 * @description
 * 设计目标：
 * - 其他 Feature 只能通过本文件访问 servers 能力；
 * - 禁止跨 Feature 直接引用 `servers/presentation/*` 等内部目录；
 * - 由该文件显式声明可协作的最小公开面。
 */

export {
  addServer,
  currentServerInfo,
  currentServerInfoStore,
  currentServerSocket,
  getTlsConfigForSocket,
  serverRacks,
  setServerSocket,
  updateServerRack,
  useServerInfoStore,
  type ServerRack,
  type ServerTlsConfig,
} from "./presentation/store";

export { useCurrentServerContext, useTrimmedString, type ServerContext } from "./presentation/composables/useServerContext";
