/**
 * @fileoverview domainCatalogPort.ts
 * @description plugins｜数据层实现：DomainCatalogPort（HTTP）。
 */

import type { DomainCatalogPort } from "../domain/ports/DomainCatalogPort";
import type { DomainCatalogItem } from "../domain/types/domainCatalogTypes";
import { fetchServerDomainCatalog } from "./httpDomainCatalog";

/**
 * HTTP 版本的 DomainCatalogPort 实现。
 *
 * @constant
 */
export const domainCatalogPort: DomainCatalogPort = {
  fetch(serverSocket: string): Promise<DomainCatalogItem[]> {
    return fetchServerDomainCatalog(serverSocket);
  },
};

