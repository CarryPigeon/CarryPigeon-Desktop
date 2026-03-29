/**
 * @fileoverview rack.di.ts
 * @description server-connection/rack｜依赖组装（DI）：rack.di。
 */

import type { ServerRackStatePort } from "../domain/ports/ServerRackStatePort";
import { localServerRackStatePort } from "../data/localServerRackStatePort";

/**
 * 获取机架状态持久化端口。
 *
 * @returns `ServerRackStatePort` 实例。
 */
export function getServerRackStatePort(): ServerRackStatePort {
  return localServerRackStatePort;
}

