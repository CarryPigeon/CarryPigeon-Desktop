/**
 * @fileoverview mockPluginCatalogPort.ts
 * @description plugins｜Mock 实现：PluginCatalogPort。
 */

import { MOCK_DISABLE_REQUIRED_GATE, MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { sleep } from "@/shared/mock/sleep";
import type { PluginCatalogPort } from "../domain/ports/PluginCatalogPort";
import type { PluginCatalogEntry } from "../domain/types/pluginTypes";

function toPluginCatalogEntries(): PluginCatalogEntry[] {
  return MOCK_PLUGIN_CATALOG.map((p) => ({
    pluginId: p.pluginId,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    homepage: p.homepage,
    source: p.source,
    downloadUrl: p.downloadUrl,
    sha256: p.sha256,
    required: !MOCK_DISABLE_REQUIRED_GATE && p.required,
    versions: p.versions,
    versionEntries: p.versions.map((version) => ({
      version,
      source: p.source,
      downloadUrl: p.downloadUrl,
      sha256: p.sha256,
    })),
    providesDomains: p.providesDomains,
    permissions: p.permissions,
  }));
}

export const mockPluginCatalogPort: PluginCatalogPort = {
  async listCatalog(_serverSocket: string): Promise<PluginCatalogEntry[]> {
    void _serverSocket;
    await sleep(Math.min(240, MOCK_LATENCY_MS));
    return toPluginCatalogEntries();
  },
};
