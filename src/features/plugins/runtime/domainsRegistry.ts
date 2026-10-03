/**
 * @fileoverview plugins 运行时：domain 绑定注册表（宿主共享）。
 * @description
 * 每个 server 一份，承载「domain → 插件渲染/输入组件」的绑定。插件通过 `ctx.domains`
 * 写入，插件 fiber 销毁时由 `applyPlugin` 统一反注册。
 *
 * 该注册表是纯数据（Map），由 domainRegistryStore 在 enable/disable 后投影到 Vue 响应式
 * 的 `bindingByDomain`，供 chat 消费；注册表本身不依赖 Vue。
 */

import type { Component } from "vue";
import type { DomainBinding } from "@/features/plugins/contracts/domainRegistry";
import type { PluginRuntimeContract } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";

export type DomainsRegistry = {
  /** 当前全部绑定（浅拷贝值对象）。 */
  list(): Record<string, DomainBinding>;
  /** 查询单个 domain 绑定。 */
  get(domain: string): DomainBinding | null;
  /** 预置插件声明的 domain 绑定（无渲染器时也保留 binding，供降级提示）。 */
  seed(runtime: PluginRuntimeEntry): void;
  /** 写入/更新渲染器。 */
  setRenderer(runtime: PluginRuntimeEntry, domain: string, component: Component): void;
  /** 写入/更新输入组件。 */
  setComposer(runtime: PluginRuntimeEntry, domain: string, component: Component): void;
  /** 写入/更新契约。 */
  setContract(runtime: PluginRuntimeEntry, domain: string, contract: PluginRuntimeContract): void;
  /** 反注册某插件的全部 domain。 */
  unregister(pluginId: string): void;
};

function normalize(value: string | undefined): string {
  return String(value ?? "").trim();
}

export function createDomainsRegistry(): DomainsRegistry {
  const bindings = new Map<string, DomainBinding>();

  function ensureBinding(
    runtime: PluginRuntimeEntry,
    domain: string,
    domainVersion?: string,
  ): DomainBinding {
    const key = normalize(domain);
    const existing = bindings.get(key);
    if (existing) return existing;
    const created: DomainBinding = {
      pluginId: runtime.pluginId,
      pluginVersion: runtime.version,
      domain: key,
      domainVersion: normalize(domainVersion) || "1.0.0",
    };
    bindings.set(key, created);
    return created;
  }

  return {
    list(): Record<string, DomainBinding> {
      const out: Record<string, DomainBinding> = {};
      for (const [domain, binding] of bindings) out[domain] = binding;
      return out;
    },
    get(domain: string): DomainBinding | null {
      return bindings.get(normalize(domain)) ?? null;
    },
    seed(runtime: PluginRuntimeEntry): void {
      for (const item of runtime.providesDomains ?? []) {
        const domain = normalize(item.domain);
        if (!domain) continue;
        ensureBinding(runtime, domain, item.domainVersion);
      }
    },
    setRenderer(runtime: PluginRuntimeEntry, domain: string, component: Component): void {
      const key = normalize(domain);
      if (!key) return;
      const binding = ensureBinding(runtime, key);
      binding.renderer = component;
    },
    setComposer(runtime: PluginRuntimeEntry, domain: string, component: Component): void {
      const key = normalize(domain);
      if (!key) return;
      const binding = ensureBinding(runtime, key);
      binding.composer = component;
    },
    setContract(runtime: PluginRuntimeEntry, domain: string, contract: PluginRuntimeContract): void {
      const key = normalize(domain) || normalize(contract.domain);
      if (!key) return;
      const binding = ensureBinding(runtime, key, contract.domainVersion);
      binding.contract = contract;
    },
    unregister(pluginId: string): void {
      const id = normalize(pluginId);
      if (!id) return;
      for (const [domain, binding] of bindings) {
        if (binding.pluginId === id) bindings.delete(domain);
      }
    },
  };
}
