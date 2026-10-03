/**
 * @fileoverview plugins 运行时：模块加载与规范化。
 * @description
 * 负责动态 import 插件 ESM、按 `entryApiVersion` 分流（v2 Cordis / v1 适配器），
 * 并产出宿主可消费的 `LoadedPluginRuntime`。
 *
 * 说明：
 * - 权限 / providesDomains / ipcPrefixes 一律以 Rust 侧 runtime entry（已校验 manifest）为准，
 *   插件 JS 模块中的 `manifest` 导出仅作信息参考，不参与权限判定；
 * - mock 模式下合成 v1 形状的假模块，复用同一适配器路径。
 */

import { defineComponent, h, ref, type Component } from "vue";
import { IS_STORE_MOCK, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import {
  ensurePluginStylesheet,
  importPluginModule,
  toAppPluginEntryUrl,
  toPluginStyleUrl,
} from "@/features/plugins/presentation/runtime/pluginRuntime";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";
import { legacyToCordis, type PluginRuntimeModuleV1 } from "./legacyAdapter";
import type { Plugin } from "./types";

/** 宿主消费的插件运行时对象。 */
export type LoadedPluginRuntime = {
  pluginId: string;
  version: string;
  /** 入口 API 版本（1 / 2）。 */
  apiVersion: number;
  /** 插件模块导出的 manifest（信息参考，非权限来源）。 */
  manifest: unknown;
  /** 权限（来自 Rust 校验清单）。 */
  permissions: string[];
  /** 提供的 domain（来自 Rust 校验清单）。 */
  providesDomains: Array<{ domain: string; domainVersion: string }>;
  /** IPC 白名单前缀（来自 Rust 校验清单）。 */
  ipcPrefixes: string[];
  /** Cordis 插件对象（v2 直接使用；v1 经适配器包装）。 */
  plugin: Plugin;
  /** v1 原始模块（仅 v1 存在，供调试与兼容测试）。 */
  legacy?: PluginRuntimeModuleV1;
};

/** 解析导入 URL：根相对/绝对 entry 直接使用，其余走 app:// 分发。 */
function resolveEntryUrl(runtime: PluginRuntimeEntry): string {
  const entry = String(runtime.entry ?? "").trim();
  if (!entry) {
    throw createPluginRuntimeError("missing_plugin_entry_url", "缺少插件 entry");
  }
  if (/^(https?:)?\/\//u.test(entry) || entry.startsWith("/")) return entry;
  return toAppPluginEntryUrl(runtime);
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

function createMockRuntimeModule(runtime: PluginRuntimeEntry): LoadedPluginRuntime {
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
  const legacyModule: PluginRuntimeModuleV1 = {
    manifest: catalog ?? null,
    renderers,
    composers,
    contracts: providesDomains.map((item) => ({
      domain: item.domain,
      domainVersion: item.domainVersion,
      constraints: { mock: true },
    })),
  };
  return {
    pluginId: runtime.pluginId,
    version: runtime.version,
    apiVersion: 1,
    manifest: legacyModule.manifest,
    permissions: runtime.permissions,
    providesDomains,
    ipcPrefixes: runtime.ipcPrefixes,
    plugin: legacyToCordis(legacyModule, runtime),
    legacy: legacyModule,
  };
}

/**
 * 规范化 import 得到的模块命名空间。
 *
 * @param runtime - 插件 runtime entry。
 * @param mod - `import()` 得到的模块命名空间。
 * @returns 宿主可消费的 `LoadedPluginRuntime`。
 */
export function normalizePluginRuntimeModule(
  runtime: PluginRuntimeEntry,
  mod: Record<string, unknown>,
): LoadedPluginRuntime {
  const apiVersion = Number(runtime.entryApiVersion) >= 2 ? 2 : 1;
  const base = {
    pluginId: runtime.pluginId,
    version: runtime.version,
    manifest: mod.manifest ?? null,
    permissions: runtime.permissions,
    providesDomains: (runtime.providesDomains ?? []).map((item) => ({
      domain: String(item.domain ?? "").trim(),
      domainVersion: String(item.domainVersion ?? "").trim() || "1.0.0",
    })),
    ipcPrefixes: runtime.ipcPrefixes,
  };

  if (apiVersion >= 2) {
    if (typeof (mod as { apply?: unknown }).apply !== "function") {
      throw createPluginRuntimeError(
        "plugin_invalid_entry",
        `Plugin ${runtime.pluginId} declares entryApiVersion=2 but module has no apply(ctx) export`,
        { pluginId: runtime.pluginId },
      );
    }
    return { ...base, apiVersion: 2, plugin: mod as unknown as Plugin };
  }

  const legacyModule = mod as PluginRuntimeModuleV1;
  return {
    ...base,
    apiVersion: 1,
    plugin: legacyToCordis(legacyModule, runtime),
    legacy: legacyModule,
  };
}

/**
 * 加载并规范化插件运行时模块。
 *
 * @param runtime - 插件 runtime entry。
 * @returns 宿主可消费的 `LoadedPluginRuntime`。
 */
export async function loadPluginRuntimeModule(runtime: PluginRuntimeEntry): Promise<LoadedPluginRuntime> {
  if ((IS_STORE_MOCK || USE_MOCK_TRANSPORT) && runtime.entry === "mock-runtime") {
    return createMockRuntimeModule(runtime);
  }
  const entryUrl = resolveEntryUrl(runtime);
  // 插件样式由构建抽取到同目录 style.css，JS 产物不含样式导入，必须由宿主加载。
  ensurePluginStylesheet(toPluginStyleUrl(entryUrl));
  const moduleNamespace = await importPluginModule(entryUrl);
  return normalizePluginRuntimeModule(runtime, moduleNamespace);
}
