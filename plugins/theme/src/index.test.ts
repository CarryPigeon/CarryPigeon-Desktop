// 主题插件入口单测：宿主偏好代理、旧偏好迁移、系统配色跟随、工具栏循环与清理。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginChatContext, PluginContext, ToolbarAction } from "@/features/plugins/api-types";

// 插件只借用宿主的 Icon 组件实例，测试中不需要真实 TDesign 运行时。
vi.mock("tdesign-vue-next", () => ({ Icon: { name: "TIcon" } }));

import { HOST_THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY } from "./domain/themes";
import { activate, deactivate } from "./index";

type MediaListener = (event: { matches: boolean }) => void;

let systemDark = false;
const mediaListeners = new Set<MediaListener>();

/** 安装可编程的 matchMedia（`matches` 实时读取 `systemDark`）。 */
function installMatchMedia(): void {
  const mediaQueryList = {
    get matches(): boolean {
      return systemDark;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: string, listener: MediaListener): void => {
      mediaListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: MediaListener): void => {
      mediaListeners.delete(listener);
    },
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
}

/** 模拟系统配色切换到指定值，并通知所有监听者。 */
function emitSystemTheme(dark: boolean): void {
  systemDark = dark;
  for (const listener of [...mediaListeners]) listener({ matches: dark });
}

/** 等待挂起的 promise 链（迁移逻辑）执行完毕。 */
async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** 构造仅包含本插件所需能力的 host 上下文。 */
function createPluginContext(legacyValue: unknown = null): {
  ctx: PluginContext;
  actions: ToolbarAction[];
  storageGet: ReturnType<typeof vi.fn>;
  storageSet: ReturnType<typeof vi.fn>;
} {
  const storageGet = vi.fn(async (key: string) => (key === LEGACY_THEME_STORAGE_KEY ? legacyValue : null));
  const storageSet = vi.fn(async () => {});
  const actions: ToolbarAction[] = [];
  const ctx = {
    host: {
      storage: { get: storageGet, set: storageSet },
      registerToolbarAction: (action: ToolbarAction): (() => void) => {
        actions.push(action);
        return () => {
          const index = actions.indexOf(action);
          if (index >= 0) actions.splice(index, 1);
        };
      },
    },
  } as unknown as PluginContext;
  return { ctx, actions, storageGet, storageSet };
}

function appliedTheme(): string | undefined {
  return document.documentElement.dataset.theme;
}

const chatContext = { channelId: "c1" } as PluginChatContext;

describe("theme 插件", () => {
  beforeEach(() => {
    localStorage.clear();
    systemDark = false;
    mediaListeners.clear();
    installMatchMedia();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.accent;
    delete document.body.dataset.theme;
  });

  afterEach(() => {
    deactivate();
    vi.unstubAllGlobals();
  });

  it("宿主 key 存在时按宿主偏好应用，且完全不触碰 data-accent", () => {
    localStorage.setItem(HOST_THEME_STORAGE_KEY, "dark");
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.accent = "patchbay";
    document.body.dataset.accent = "patchbay";
    const { ctx, storageGet } = createPluginContext();

    activate(ctx);

    expect(appliedTheme()).toBe("dark");
    expect(document.body.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.accent).toBe("patchbay");
    expect(document.body.dataset.accent).toBe("patchbay");
    // 宿主 key 已就绪时不应读取旧插件键。
    expect(storageGet).not.toHaveBeenCalled();
  });

  it("system 偏好跟随系统配色，并在系统切换时实时同步", () => {
    systemDark = true;
    localStorage.setItem(HOST_THEME_STORAGE_KEY, "system");
    const { ctx } = createPluginContext();

    activate(ctx);
    expect(appliedTheme()).toBe("dark");

    emitSystemTheme(false);
    expect(appliedTheme()).toBe("light");

    emitSystemTheme(true);
    expect(appliedTheme()).toBe("dark");
  });

  it("宿主 key 缺失时迁移旧插件偏好到宿主 key，并清空旧键", async () => {
    const { ctx, storageSet } = createPluginContext(JSON.stringify({ theme: "patchbay", accent: "violet" }));

    activate(ctx);
    await flushAsync();

    expect(appliedTheme()).toBe("dark");
    expect(localStorage.getItem(HOST_THEME_STORAGE_KEY)).toBe("dark");
    expect(storageSet).toHaveBeenCalledWith(LEGACY_THEME_STORAGE_KEY, null);
  });

  it("无任何偏好时保持当前 DOM 主题不变（不得用插件默认值覆盖宿主）", async () => {
    document.documentElement.dataset.theme = "dark";
    const { ctx } = createPluginContext(null);

    activate(ctx);
    await flushAsync();

    expect(appliedTheme()).toBe("dark");
    expect(localStorage.getItem(HOST_THEME_STORAGE_KEY)).toBeNull();
  });

  it("显式关闭系统监听：非 system 偏好下不注册媒体查询监听", () => {
    localStorage.setItem(HOST_THEME_STORAGE_KEY, "dark");
    const { ctx } = createPluginContext();

    activate(ctx);

    expect(mediaListeners.size).toBe(0);
  });

  it("工具栏动作按 亮→暗→跟随系统 循环并写回宿主 key", () => {
    localStorage.setItem(HOST_THEME_STORAGE_KEY, "light");
    const { ctx, actions } = createPluginContext();
    activate(ctx);
    expect(actions).toHaveLength(1);

    actions[0]!.onClick(chatContext);
    expect(localStorage.getItem(HOST_THEME_STORAGE_KEY)).toBe("dark");
    expect(appliedTheme()).toBe("dark");

    actions[0]!.onClick(chatContext);
    expect(localStorage.getItem(HOST_THEME_STORAGE_KEY)).toBe("system");

    actions[0]!.onClick(chatContext);
    expect(localStorage.getItem(HOST_THEME_STORAGE_KEY)).toBe("light");
    expect(appliedTheme()).toBe("light");
  });

  it("无存储偏好时切换起点取当前生效主题", () => {
    document.documentElement.dataset.theme = "light";
    const { ctx, actions } = createPluginContext();
    activate(ctx);

    actions[0]!.onClick(chatContext);

    expect(localStorage.getItem(HOST_THEME_STORAGE_KEY)).toBe("dark");
    expect(appliedTheme()).toBe("dark");
  });

  it("deactivate 摘除工具栏入口与系统配色监听", () => {
    localStorage.setItem(HOST_THEME_STORAGE_KEY, "system");
    const { ctx, actions } = createPluginContext();
    activate(ctx);
    expect(actions).toHaveLength(1);
    expect(mediaListeners.size).toBe(1);

    deactivate();

    expect(actions).toHaveLength(0);
    expect(mediaListeners.size).toBe(0);
  });
});
