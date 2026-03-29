/**
 * @fileoverview domain registry binding helpers
 * @description
 * 管理 domain -> plugin 的绑定表，避免 registry store 内部混入过多绑定细节。
 */

import type { LoadedPluginModule } from "@/features/plugins/presentation/runtime/pluginRuntime";
import type { DomainBinding } from "@/features/plugins/contracts/domainRegistry";

export function registerPluginDomains(
  bindingByDomain: Record<string, DomainBinding>,
  plugin: LoadedPluginModule,
): void {
  for (const item of plugin.providesDomains) {
    const domain = String(item.domain ?? "").trim();
    const domainVersion = String(item.domainVersion ?? "").trim() || "1.0.0";
    if (!domain) continue;
    const binding: DomainBinding = {
      pluginId: plugin.pluginId,
      pluginVersion: plugin.version,
      domain,
      domainVersion,
      renderer: plugin.renderers[domain],
      composer: plugin.composers[domain],
      contract: plugin.contracts.find((contract) => String(contract.domain ?? "").trim() === domain),
    };
    bindingByDomain[domain] = binding;
  }
}

export function unregisterPluginDomains(
  bindingByDomain: Record<string, DomainBinding>,
  pluginId: string,
): void {
  const normalizedPluginId = String(pluginId ?? "").trim();
  if (!normalizedPluginId) return;
  for (const domain of Object.keys(bindingByDomain)) {
    if (bindingByDomain[domain]?.pluginId === normalizedPluginId) delete bindingByDomain[domain];
  }
}
