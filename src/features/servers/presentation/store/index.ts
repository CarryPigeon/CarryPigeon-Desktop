/**
 * @fileoverview servers｜presentation/store 公共入口。
 * @description
 * 对外约定：
 * - 跨 feature 引用 servers 的 store，请优先从本入口导入，避免深层路径耦合；
 * - 本入口只做 re-export，不引入额外副作用逻辑。
 */

export { currentServerSocket, setServerSocket } from "./currentServer";

export {
  addServer,
  getTlsConfigForSocket,
  serverRacks,
  updateServerRack,
  type ServerRack,
  type ServerTlsConfig,
} from "./serverList";

export { useServerInfoStore, currentServerInfo, currentServerInfoStore } from "./serverInfoStore";

