/**
 * @fileoverview ContextMenuHost.test.ts
 * @description shared/ui｜全局右键菜单宿主：原生菜单屏蔽、输入区/选区菜单与动作派发验证。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import ContextMenuHost from "./ContextMenuHost.vue";

const readClipboardTextMock = vi.fn(async () => "PASTED");
const copyTextToClipboardMock = vi.fn(async (_text: string) => true);

vi.mock("@/shared/utils/clipboard", () => ({
  canReadClipboardText: () => true,
  copyTextToClipboard: (text: string) => copyTextToClipboardMock(text),
  readClipboardText: () => readClipboardTextMock(),
}));

let wrapper: VueWrapper | null = null;

/**
 * 挂载全局右键菜单宿主。
 *
 * @returns 测试用 wrapper。
 */
function mountHost(): VueWrapper {
  wrapper = mount(ContextMenuHost, {
    global: {
      // 菜单通过 <teleport to="body"> 渲染；测试中就地渲染，便于用 wrapper 查询。
      stubs: { teleport: true },
      plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } })],
    },
  });
  return wrapper;
}

/**
 * 派发右键事件。
 *
 * @param target - 事件目标。
 * @param init - 鼠标事件初始化参数。
 * @returns 事件对象。
 */
function dispatchContextMenu(target: EventTarget, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 12,
    clientY: 34,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/**
 * 菜单条目文案。
 *
 * @param host - 宿主 wrapper。
 * @returns 文案数组。
 */
function itemLabels(host: VueWrapper): string[] {
  return host.findAll(".cp-menu__item").map((item) => item.text());
}

beforeEach(() => {
  readClipboardTextMock.mockClear();
  copyTextToClipboardMock.mockClear();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("ContextMenuHost", () => {
  it("输入区右键：屏蔽原生菜单并给出编辑菜单", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = "hello";
    document.body.appendChild(textarea);
    const host = mountHost();

    const event = dispatchContextMenu(textarea);
    await nextTick();

    expect(event.defaultPrevented).toBe(true);
    const labels = itemLabels(host);
    expect(labels.some((label) => label.includes("撤销"))).toBe(true);
    expect(labels.some((label) => label.includes("粘贴"))).toBe(true);
    expect(labels.some((label) => label.includes("全选"))).toBe(true);
  });

  it("组件已 preventDefault 时不接管", async () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    const host = mountHost();

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    event.preventDefault();
    textarea.dispatchEvent(event);
    await nextTick();

    expect(host.find(".cp-menu").exists()).toBe(false);
  });

  it("禁用输入框与无选中的普通区域都不打开菜单", async () => {
    const disabled = document.createElement("textarea");
    disabled.disabled = true;
    document.body.appendChild(disabled);
    const paragraph = document.createElement("p");
    paragraph.textContent = "plain";
    document.body.appendChild(paragraph);
    const host = mountHost();

    const first = dispatchContextMenu(disabled);
    await nextTick();
    expect(first.defaultPrevented).toBe(true);
    expect(host.find(".cp-menu").exists()).toBe(false);

    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "",
    } as unknown as Selection);
    const second = dispatchContextMenu(paragraph);
    await nextTick();
    expect(second.defaultPrevented).toBe(true);
    expect(host.find(".cp-menu").exists()).toBe(false);
  });

  it("文本选区右键：只给出复制/全选", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "selected text";
    document.body.appendChild(paragraph);
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "selected text",
    } as unknown as Selection);
    const host = mountHost();

    dispatchContextMenu(paragraph);
    await nextTick();

    const labels = itemLabels(host);
    expect(labels).toHaveLength(2);
    expect(labels.some((label) => label.includes("复制"))).toBe(true);
    expect(labels.some((label) => label.includes("全选"))).toBe(true);
  });

  it("点击条目执行动作并关闭菜单", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = "hello";
    document.body.appendChild(textarea);
    const host = mountHost();

    dispatchContextMenu(textarea);
    await nextTick();

    const paste = host
      .findAll(".cp-menu__item")
      .find((item) => item.text().includes("粘贴"));
    expect(paste).toBeDefined();
    await paste?.trigger("click");
    await nextTick();

    await vi.waitFor(() => expect(readClipboardTextMock).toHaveBeenCalledTimes(1));
    expect(host.find(".cp-menu").exists()).toBe(false);
  });

  it("Escape 与 backdrop 点击都可关闭菜单", async () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    const host = mountHost();

    dispatchContextMenu(textarea);
    await nextTick();
    expect(host.find(".cp-menu").exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(host.find(".cp-menu").exists()).toBe(false);

    dispatchContextMenu(textarea);
    await nextTick();
    await host.find(".cp-menu__backdrop").trigger("click");
    await nextTick();
    expect(host.find(".cp-menu").exists()).toBe(false);
  });
});
