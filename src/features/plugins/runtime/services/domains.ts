/**
 * @fileoverview plugins 运行时能力服务：domains 注册。
 */

import type { Component } from "vue";
import type { PluginRuntimeContract } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { DomainsRegistry } from "../domainsRegistry";
import type { PluginDomainsService } from "../types";

/**
 * 创建 domain 注册能力服务（写入宿主共享注册表）。
 *
 * @param registry 共享注册表。
 * @param runtime 插件 runtime entry（用于填充 pluginId / 版本）。
 */
export function createDomainsService(
  registry: DomainsRegistry,
  runtime: PluginRuntimeEntry,
): PluginDomainsService {
  return {
    renderer(domain: string, component: Component): void {
      registry.setRenderer(runtime, domain, component);
    },
    composer(domain: string, component: Component): void {
      registry.setComposer(runtime, domain, component);
    },
    contract(contract: PluginRuntimeContract): void {
      registry.setContract(runtime, contract.domain, contract);
    },
  };
}
