/**
 * @fileoverview DomainCatalogPort.ts
 * @description plugins｜领域端口：DomainCatalogPort。
 *
 * 用途：
 * - `GET /api/domains/catalog` 的访问能力抽象；
 * - 该接口为 public，可在 required-gate 流程中调用（未登录也可用）。
 */

import type { DomainCatalogItem } from "../types/domainCatalogTypes";

/**
 * Domain catalog 端口（领域层）。
 */
export interface DomainCatalogPort {
  /**
   * 拉取服务端 domain 目录。
   *
   * @param serverSocket - 服务端 socket（用于推导 HTTP origin）。
   * @returns domain 目录条目列表。
   */
  fetch(serverSocket: string): Promise<DomainCatalogItem[]>;
}

