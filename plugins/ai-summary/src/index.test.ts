/**
 * @fileoverview ai-summary 插件入口单测（Cordis v2 契约）。
 * @description 覆盖：浮层挂载与工具栏入口注册、设置项注册（`ctx.ui.registerSettingsItem`）、
 * 后端偏好预载入、dispose 解绑上下文。旧宿主无 `registerSettingsItem` 时不抛错。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import type { Context } from "@/features/plugins/sdk";
import { resetBackendPreferenceForTests } from "./host/backendPreference";
import { resetProviderConfigForTests } from "./host/providerConfig";
import { SUMMARIZE_BACKEND_STORAGE_KEY } from "./domain/summarizeBackend";
import { getContext, unbindContext } from "./host/bridge";

// 插件只借用宿主的 Icon 组件实例，测试中不需要真实 TDesign 运行时。
vi.mock("tdesign-vue-next", () => ({ Icon: { name: "TIcon" } }));

import { apply } from "./index";

type RegisteredSettingsItem = {
  id: string;
  title: string;
  description?: string;
  keywords?: readonly string[];
  order?: number;
  component: Component;
};

type ContextStub = {
  ctx: Context;
  settingsItems: RegisteredSettingsItem[];
  toolbarActions: unknown[];
  storage: Map<string, unknown>;
  dispose(): void;
};

/**
 * 构造仅包含本插件所需能力的 Cordis 风格上下文。
 *
 * @param options - `withSettingsItem` 为 false 时模拟不支持设置项的旧宿主。
 * @returns 上下文桩与调用记录。
 */
function createPluginContext(options: { withSettingsItem?: boolean } = {}): ContextStub {
  const withSettingsItem = options.withSettingsItem !== false;
  const settingsItems: RegisteredSettingsItem[] = [];
  const toolbarActions: unknown[] = [];
  const storage = new Map<string, unknown>();
  const disposeCallbacks: Array<() => void> = [];
  let overlayUnmounted = 0;

  const ui: Record<string, unknown> = {
    mountOverlay: () => ({
      unmount: () => {
        overlayUnmounted += 1;
      },
      instance: null,
    }),
    registerToolbarAction: (action: unknown) => {
      toolbarActions.push(action);
      return () => {};
    },
  };
  if (withSettingsItem) {
    ui.registerSettingsItem = (item: RegisteredSettingsItem) => {
      settingsItems.push(item);
      return () => {};
    };
  }

  const ctx = {
    server: { lang: "zh_cn", getUid: () => "", getCid: () => "", serverSocket: "", serverId: "" },
    storage: {
      async get(key: string) {
        return storage.get(key) ?? null;
      },
      async set(key: string, value: unknown) {
        storage.set(key, value);
      },
    },
    ui,
    on: (event: string, cb: () => void): (() => boolean) => {
      if (event === "dispose") disposeCallbacks.push(cb);
      return () => true;
    },
  } as unknown as Context;

  return {
    ctx,
    settingsItems,
    toolbarActions,
    storage,
    dispose() {
      for (const cb of disposeCallbacks.splice(0)) cb();
      void overlayUnmounted;
    },
  };
}

/** 等待 apply 内的异步预载入（后端偏好）完成。 */
async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ai-summary 插件入口", () => {
  beforeEach(() => {
    resetBackendPreferenceForTests();
    resetProviderConfigForTests();
  });

  afterEach(() => {
    unbindContext();
  });

  it("注册工具栏入口与两组设置项（后端 + 自管 provider，含可搜索元数据）", () => {
    const { ctx, settingsItems, toolbarActions } = createPluginContext();

    apply(ctx);

    expect(toolbarActions).toHaveLength(1);
    expect(settingsItems).toHaveLength(2);
    const backend = settingsItems[0]!;
    expect(backend.id).toBe("backend");
    expect(backend.title).toBe("AI 摘要后端");
    expect(backend.order).toBe(10);
    expect(backend.component).toBeTruthy();
    expect(backend.keywords ?? []).toContain("后端");
    const provider = settingsItems[1]!;
    expect(provider.id).toBe("provider");
    expect(provider.title).toBe("AI 服务提供方");
    expect(provider.order).toBe(20);
    expect(provider.component).toBeTruthy();
    expect(provider.keywords ?? []).toContain("密钥");
  });

  it("apply 时预载入已保存的后端档位", async () => {
    const { ctx, storage } = createPluginContext();
    storage.set(SUMMARIZE_BACKEND_STORAGE_KEY, "server");

    apply(ctx);
    await flushAsync();

    const { getBackend } = await import("./host/backendPreference");
    expect(getBackend()).toBe("server");
  });

  it("旧宿主（无 registerSettingsItem）不抛错，工具栏入口照常注册", () => {
    const { ctx, toolbarActions } = createPluginContext({ withSettingsItem: false });

    expect(() => apply(ctx)).not.toThrow();
    expect(toolbarActions).toHaveLength(1);
  });

  it("dispose 解绑上下文", () => {
    const { ctx, dispose } = createPluginContext();
    apply(ctx);

    dispose();

    // 解绑后 getContext 抛错（面板组件依赖该语义做兜底）。
    expect(() => getContext()).toThrow();
  });
});
