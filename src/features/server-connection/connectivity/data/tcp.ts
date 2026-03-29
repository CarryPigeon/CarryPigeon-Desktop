/**
 * @fileoverview server-connection/connectivity/data 对外导出入口。
 */
export { TcpService } from "./TcpService";
export {
  createServerTcpService,
  startTcpServiceRuntime as startTcpRuntime,
  stopTcpServiceRuntime as stopTcpRuntime,
} from "./tcpRuntime";
