/**
 * @fileoverview servers.di.ts
 * @description servers｜依赖组装（DI）：servers.di。
 */

import { USE_MOCK_API, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { GetServerInfo } from "../domain/usecases/GetServerInfo";
import { mockServerInfoPort } from "../mock/mockServerInfoPort";
import { httpServerInfoPort } from "../data/httpServerInfoPort";
import type { ServerInfoPort } from "../domain/ports/ServerInfoPort";

let serverInfoPort: ServerInfoPort | null = null;
let getServerInfo: GetServerInfo | null = null;

/**
 * 获取 `ServerInfoPort`（单例）。
 *
 * 选择规则：
 * - `USE_MOCK_TRANSPORT=true`：使用真实 HTTP 适配器（便于协议层联调）。
 * - `USE_MOCK_API=true`：使用内存 mock（用于 UI 预览/开发联调）。
 * - 其它情况：使用真实 HTTP 适配器。
 *
 * @returns `ServerInfoPort` 实例。
 */
export function getServerInfoPort(): ServerInfoPort {
  if (serverInfoPort) return serverInfoPort;
  serverInfoPort = USE_MOCK_TRANSPORT ? httpServerInfoPort : USE_MOCK_API ? mockServerInfoPort : httpServerInfoPort;
  return serverInfoPort;
}

/**
 * 获取 `GetServerInfo` 用例（单例）。
 *
 * @returns `GetServerInfo` 实例。
 */
export function getGetServerInfoUsecase(): GetServerInfo {
  if (getServerInfo) return getServerInfo;
  getServerInfo = new GetServerInfo(getServerInfoPort());
  return getServerInfo;
}
