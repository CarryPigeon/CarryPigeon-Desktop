/**
 * @fileoverview domain registry module loader helpers
 * @description
 * 抽离运行时加载开关、noop 模块与模块加载逻辑，减少 registry store 内部噪音。
 */

import { IS_STORE_MOCK, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import { defineComponent, h, ref, type Component } from "vue";
import {
  importPluginModule,
  normalizePluginModule,
  toAppPluginEntryUrl,
  type LoadedPluginModule,
} from "@/features/plugins/presentation/runtime/pluginRuntime";

export function isPluginRuntimeLoadingDisabled(): boolean {
  return false;
}

export function createNoopLoadedPluginModule(pluginId: string, version: string): LoadedPluginModule {
  return {
    pluginId: String(pluginId ?? "").trim(),
    version: String(version ?? "").trim() || "0.0.0",
    manifest: null,
    permissions: [],
    providesDomains: [],
    renderers: {},
    composers: {},
    contracts: [],
  };
}

export async function loadPluginRuntimeModule(runtime: PluginRuntimeEntry): Promise<LoadedPluginModule> {
  if ((IS_STORE_MOCK || USE_MOCK_TRANSPORT) && runtime.entry === "mock-runtime") {
    return createMockLoadedPluginModule(runtime);
  }
  const entryUrl = toAppPluginEntryUrl(runtime);
  const moduleNamespace = await importPluginModule(entryUrl);
  return normalizePluginModule(runtime.pluginId, runtime.version, runtime, moduleNamespace);
}

function createMockRenderer(domain: string): Component {
  return defineComponent({
    name: "MockPluginRenderer",
    props: {
      data: { type: null, required: false },
      preview: { type: String, required: false },
    },
    setup(props) {
      return () =>
        h("div", { class: "cp-mock-plugin-renderer" }, [
          h("strong", `${domain}`),
          h("div", String(props.preview || "Mock plugin payload")),
          h("pre", JSON.stringify(props.data ?? {}, null, 2)),
        ]);
    },
  });
}

function createMockComposer(domain: string, domainVersion: string): Component {
  return defineComponent({
    name: "MockPluginComposer",
    props: {
      disabled: { type: Boolean, required: false },
      replyToMid: { type: String, required: false },
    },
    emits: ["submit"],
    setup(props, { emit }) {
      const draft = ref("");
      function submit(): void {
        const text = draft.value.trim();
        if (!text || props.disabled) return;
        emit("submit", {
          domain,
          domainVersion,
          data: { text },
          replyToMessageId: props.replyToMid || undefined,
        });
        draft.value = "";
      }
      return () =>
        h("div", { class: "cp-mock-plugin-composer" }, [
          h("textarea", {
            value: draft.value,
            disabled: props.disabled,
            placeholder: `Mock ${domain} payload`,
            onInput: (event: Event) => {
              draft.value = String((event.target as HTMLTextAreaElement | null)?.value ?? "");
            },
          }),
          h(
            "button",
            {
              type: "button",
              disabled: props.disabled || !draft.value.trim(),
              onClick: submit,
            },
            "Send plugin message",
          ),
        ]);
    },
  });
}

function createMockLoadedPluginModule(runtime: PluginRuntimeEntry): LoadedPluginModule {
  const catalog = MOCK_PLUGIN_CATALOG.find((plugin) => plugin.pluginId === runtime.pluginId);
  const providesDomains = runtime.providesDomains.length
    ? runtime.providesDomains
    : (catalog?.providesDomains ?? []).map((domain) => ({
        domain: domain.id,
        domainVersion: domain.version,
      }));
  const renderers: Record<string, Component> = {};
  const composers: Record<string, Component> = {};
  for (const item of providesDomains) {
    const domain = String(item.domain ?? "").trim();
    const domainVersion = String(item.domainVersion ?? "").trim() || "1.0.0";
    if (!domain) continue;
    renderers[domain] = createMockRenderer(domain);
    if (domain !== "Core:Text") composers[domain] = createMockComposer(domain, domainVersion);
  }
  return {
    pluginId: runtime.pluginId,
    version: runtime.version,
    manifest: catalog ?? null,
    permissions: runtime.permissions,
    providesDomains,
    renderers,
    composers,
    contracts: providesDomains.map((item) => ({
      domain: item.domain,
      domainVersion: item.domainVersion,
      constraints: { mock: true },
    })),
  };
}
