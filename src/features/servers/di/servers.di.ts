/**
 * @fileoverview servers.di.ts
 * @description Composition root for servers feature (server info, identity).
 */

import { USE_MOCK_API, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { GetServerInfo } from "../domain/usecases/GetServerInfo";
import { mockServerInfoPort } from "../mock/mockServerInfoPort";
import { httpServerInfoPort } from "../data/httpServerInfoPort";
import type { ServerInfoPort } from "../domain/ports/ServerInfoPort";

let serverInfoPort: ServerInfoPort | null = null;
let getServerInfo: GetServerInfo | null = null;

/**
 * Get singleton `ServerInfoPort`.
 *
 * @returns ServerInfoPort.
 */
export function getServerInfoPort(): ServerInfoPort {
  if (serverInfoPort) return serverInfoPort;
  serverInfoPort = USE_MOCK_TRANSPORT ? httpServerInfoPort : USE_MOCK_API ? mockServerInfoPort : httpServerInfoPort;
  return serverInfoPort;
}

/**
 * Get singleton `GetServerInfo` usecase.
 *
 * @returns Usecase instance.
 */
export function getGetServerInfoUsecase(): GetServerInfo {
  if (getServerInfo) return getServerInfo;
  getServerInfo = new GetServerInfo(getServerInfoPort());
  return getServerInfo;
}
