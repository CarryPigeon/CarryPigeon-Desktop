/**
 * @fileoverview protocolMockPluginManager.ts
 * @description Protocol-mock PluginManagerPort:
 * - Catalog is fetched via HTTP (`/api/plugins/catalog`) so that `VITE_MOCK_MODE=protocol`
 *   exercises the protocol surface.
 * - Lifecycle actions (install/enable/switch/uninstall) delegate to the existing
 *   in-memory mock manager so the UI remains usable without Tauri.
 */

import type { PluginManagerPort } from "@/features/plugins/domain/ports/PluginManagerPort";
import { fetchServerPluginCatalog } from "@/features/plugins/data/httpPluginCatalog";
import { mockPluginManager } from "@/features/plugins/mock/mockPluginManager";

/**
 * Protocol-mock plugin manager.
 *
 * @constant
 */
export const protocolMockPluginManager: PluginManagerPort = {
  ...mockPluginManager,
  async listCatalog(serverSocket: string) {
    return fetchServerPluginCatalog(serverSocket);
  },
};
