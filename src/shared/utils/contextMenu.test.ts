/**
 * @fileoverview contextMenu.test.ts
 * @description shared/utils：统一右键菜单的请求解析、菜单模型与动作执行验证。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEditMenuItems,
  getShortcutHint,
  isEditableElement,
  resolveContextMenuEvent,
  runContextMenuAction,
  type ContextMenuDeps,
  type ContextMenuResolution,
} from "./contextMenu";

/** 可写回的可选 DOM 方法（用于在 jsdom 中替换/删除）。 */
type MutableDocument = {
  execCommand?: unknown;
  queryCommandEnabled?: unknown;
};

/** 记录被替换的 `document.execCommand`。 */
const originalExecCommand = (document as unknown as MutableDocument).execCommand;
/** 记录被替换的 `document.queryCommandEnabled`。 */
const originalQueryCommandEnabled = (document as unknown as MutableDocument).queryCommandEnabled;

/**
 * 派发 `contextmenu` 并在派发期间解析（`composedPath()` 仅在派发期间有值）。
 *
 * @param target - 事件目标。
 * @param init - 鼠标事件初始化参数。
 * @param options - 解析选项。
 * @returns 解析结论。
 */
function dispatchAndResolve(
  target: EventTarget,
  init: MouseEventInit = {},
  options?: Parameters<typeof resolveContextMenuEvent>[1],
): { event: MouseEvent; resolution: ContextMenuResolution } {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 10,
    clientY: 20,
    ...init,
  });
  let resolution: ContextMenuResolution | null = null;
  const listener = (e: Event): void => {
    resolution = resolveContextMenuEvent(e as MouseEvent, options);
  };
  target.addEventListener("contextmenu", listener);
  target.dispatchEvent(event);
  target.removeEventListener("contextmenu", listener);
  if (!resolution) throw new Error("resolution missing");
  return { event, resolution };
}

/**
 * 创建并挂载一个 textarea。
 *
 * @param value - 初始值。
 * @param options - 禁用/只读。
 * @returns textarea 元素。
 */
function makeTextarea(
  value = "",
  options: { disabled?: boolean; readonly?: boolean } = {},
): HTMLTextAreaElement {
  const el = document.createElement("textarea");
  el.value = value;
  if (options.disabled) el.disabled = true;
  if (options.readonly) el.readOnly = true;
  document.body.appendChild(el);
  return el;
}

/**
 * 替换 `document.execCommand`。
 *
 * @param impl - 实现（返回是否成功）；传 `undefined` 表示删除该方法（模拟 jsdom）。
 * @returns 无返回值。
 */
function stubExecCommand(impl?: () => boolean): void {
  const target = document as unknown as MutableDocument;
  if (!impl) {
    delete target.execCommand;
    return;
  }
  target.execCommand = vi.fn(() => impl());
}

/**
 * 替换 `document.queryCommandEnabled`。
 *
 * @param impl - 实现；传 `undefined` 表示删除该方法。
 * @returns 无返回值。
 */
function stubQueryCommandEnabled(impl?: (command: string) => boolean): void {
  const target = document as unknown as MutableDocument;
  if (!impl) {
    delete target.queryCommandEnabled;
    return;
  }
  target.queryCommandEnabled = vi.fn((command: string) => impl(command));
}

/**
 * 构造动作执行依赖。
 *
 * @param overrides - 覆盖项。
 * @returns 依赖对象。
 */
function makeDeps(overrides: Partial<ContextMenuDeps> = {}): ContextMenuDeps {
  return {
    canReadClipboard: () => true,
    readClipboardText: vi.fn(async () => "PASTED"),
    copyText: vi.fn(async () => true),
    notifyWarn: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  const target = document as unknown as MutableDocument;
  if (originalExecCommand === undefined) delete target.execCommand;
  else target.execCommand = originalExecCommand;
  if (originalQueryCommandEnabled === undefined) delete target.queryCommandEnabled;
  else target.queryCommandEnabled = originalQueryCommandEnabled;
  vi.restoreAllMocks();
});

describe("isEditableElement", () => {
  it("识别 textarea / 文本 input / contenteditable", () => {
    const textarea = document.createElement("textarea");
    expect(isEditableElement(textarea)).toBe(true);
    const input = document.createElement("input");
    expect(isEditableElement(input)).toBe(true);
    const contenteditable = document.createElement("div");
    (contenteditable as HTMLElement & { isContentEditable: boolean }).isContentEditable = true;
    expect(isEditableElement(contenteditable)).toBe(true);
  });

  it("排除复选框等非文本输入与普通元素", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isEditableElement(checkbox)).toBe(false);
    expect(isEditableElement(document.createElement("div"))).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });
});

describe("resolveContextMenuEvent", () => {
  it("组件已 preventDefault 时忽略（不接管）", () => {
    const textarea = makeTextarea("hello");
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    event.preventDefault();
    let resolution: ContextMenuResolution | null = null;
    const listener = (e: Event): void => {
      resolution = resolveContextMenuEvent(e as MouseEvent);
    };
    document.addEventListener("contextmenu", listener);
    textarea.dispatchEvent(event);
    document.removeEventListener("contextmenu", listener);

    expect(resolution).toEqual({ action: "ignore", reason: "handled" });
  });

  it("dev 下 Shift+右键保留原生菜单", () => {
    const textarea = makeTextarea("hello");
    const { resolution } = dispatchAndResolve(
      textarea,
      { shiftKey: true },
      { isDev: true },
    );
    expect(resolution).toEqual({ action: "ignore", reason: "native-escape" });
  });

  it("输入框命中编辑菜单，并按可用性置灰", () => {
    const textarea = makeTextarea("hello");
    textarea.setSelectionRange(1, 3);
    const { resolution } = dispatchAndResolve(
      textarea,
      {},
      { isDev: false, isMac: false, canReadClipboard: () => true },
    );

    expect(resolution.action).toBe("open");
    if (resolution.action !== "open") return;
    expect(resolution.request.kind).toBe("edit");
    expect(resolution.request.target).toBe(textarea);
    expect(resolution.request.items.map((item) => item.key)).toEqual([
      "undo",
      "redo",
      "cut",
      "copy",
      "paste",
      "selectAll",
    ]);
    const byKey = new Map(resolution.request.items.map((item) => [item.key, item]));
    expect(byKey.get("cut")?.disabled).toBe(false);
    expect(byKey.get("copy")?.disabled).toBe(false);
    expect(byKey.get("paste")?.disabled).toBe(false);
    expect(byKey.get("undo")?.shortcut).toBe("Ctrl+Z");
  });

  it("无选区时剪切/复制置灰，剪贴板不可用时粘贴置灰", () => {
    const textarea = makeTextarea("hello");
    textarea.setSelectionRange(2, 2);
    const { resolution } = dispatchAndResolve(
      textarea,
      {},
      { isDev: false, canReadClipboard: () => false },
    );
    expect(resolution.action).toBe("open");
    if (resolution.action !== "open") return;
    const byKey = new Map(resolution.request.items.map((item) => [item.key, item]));
    expect(byKey.get("cut")?.disabled).toBe(true);
    expect(byKey.get("copy")?.disabled).toBe(true);
    expect(byKey.get("paste")?.disabled).toBe(true);
  });

  it("只读输入框只保留复制/全选可用", () => {
    const textarea = makeTextarea("hello", { readonly: true });
    textarea.setSelectionRange(0, 5);
    const { resolution } = dispatchAndResolve(textarea, {}, { isDev: false });
    expect(resolution.action).toBe("open");
    if (resolution.action !== "open") return;
    const byKey = new Map(resolution.request.items.map((item) => [item.key, item]));
    expect(byKey.get("copy")?.disabled).toBe(false);
    expect(byKey.get("cut")?.disabled).toBe(true);
    expect(byKey.get("paste")?.disabled).toBe(true);
    expect(byKey.get("undo")?.disabled).toBe(true);
  });

  it("禁用输入框不打开菜单", () => {
    const textarea = makeTextarea("hello", { disabled: true });
    const { resolution } = dispatchAndResolve(textarea, {}, { isDev: false });
    expect(resolution).toEqual({ action: "none" });
  });

  it("右键落在菜单面板自身时不重新打开菜单", () => {
    const panel = document.createElement("div");
    panel.classList.add("cp-menu");
    const button = document.createElement("button");
    panel.appendChild(button);
    document.body.appendChild(panel);
    const { resolution } = dispatchAndResolve(button, {}, { isDev: false });
    expect(resolution).toEqual({ action: "none" });
  });

  it("非输入区存在文本选中时给出选区菜单", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "hello world";
    document.body.appendChild(paragraph);
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "hello world",
    } as unknown as Selection);

    const { resolution } = dispatchAndResolve(paragraph, {}, { isDev: false });
    expect(resolution.action).toBe("open");
    if (resolution.action !== "open") return;
    expect(resolution.request.kind).toBe("selection");
    expect(resolution.request.target).toBeNull();
    expect(resolution.request.items.map((item) => item.key)).toEqual(["copy", "selectAll"]);
  });

  it("非输入区且无选中时只屏蔽原生菜单", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "hello";
    document.body.appendChild(paragraph);
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "",
    } as unknown as Selection);

    const { resolution } = dispatchAndResolve(paragraph, {}, { isDev: false });
    expect(resolution).toEqual({ action: "none" });
  });

  it("queryCommandEnabled 返回 false 时撤销/重做置灰", () => {
    stubQueryCommandEnabled(() => false);
    const el = makeTextarea("hello");
    const items = buildEditMenuItems({
      target: el,
      readonly: false,
      selectionText: "",
      canPaste: true,
      isMac: false,
    });
    const byKey = new Map(items.map((item) => [item.key, item]));
    expect(byKey.get("undo")?.disabled).toBe(true);
    expect(byKey.get("redo")?.disabled).toBe(true);
  });
});

describe("getShortcutHint", () => {
  it("区分 Windows 与 macOS 提示", () => {
    expect(getShortcutHint("undo", false)).toBe("Ctrl+Z");
    expect(getShortcutHint("selectAll", false)).toBe("Ctrl+A");
    expect(getShortcutHint("undo", true)).toBe("⌘Z");
    expect(getShortcutHint("redo", true)).toBe("⇧⌘Z");
  });
});

describe("runContextMenuAction", () => {
  it("撤销/重做聚焦目标并执行命令", async () => {
    stubExecCommand(() => true);
    const el = makeTextarea("hello");
    const deps = makeDeps();
    await runContextMenuAction(
      "undo",
      { kind: "edit", target: el, readonly: false, selectionText: "", x: 0, y: 0, items: [] },
      deps,
    );
    expect(document.execCommand).toHaveBeenCalledWith("undo", false, undefined);
  });

  it("粘贴走 insertText，并在命令不可用时回退 setRangeText + input 事件", async () => {
    const el = makeTextarea("ab");
    el.setSelectionRange(1, 1);
    const inputSpy = vi.fn();
    el.addEventListener("input", inputSpy);
    const request = {
      kind: "edit" as const,
      target: el,
      readonly: false,
      selectionText: "",
      x: 0,
      y: 0,
      items: [],
    };

    stubExecCommand(() => true);
    await runContextMenuAction("paste", request, makeDeps());
    expect(document.execCommand).toHaveBeenCalledWith("insertText", false, "PASTED");
    expect(el.value).toBe("ab");

    stubExecCommand(undefined);
    await runContextMenuAction("paste", request, makeDeps());
    expect(el.value).toBe("aPASTEDb");
    expect(inputSpy).toHaveBeenCalledTimes(1);
  });

  it("剪贴板读取失败时提示 Ctrl+V", async () => {
    const el = makeTextarea("ab");
    const deps = makeDeps({
      readClipboardText: vi.fn(async () => {
        throw new Error("denied");
      }),
    });
    await runContextMenuAction(
      "paste",
      { kind: "edit", target: el, readonly: false, selectionText: "", x: 0, y: 0, items: [] },
      deps,
    );
    expect(deps.notifyWarn).toHaveBeenCalledWith("ctx_paste_unavailable");
    expect(el.value).toBe("ab");
  });

  it("复制失败时提示重试", async () => {
    const el = makeTextarea("hello");
    el.setSelectionRange(0, 5);
    const deps = makeDeps({ copyText: vi.fn(async () => false) });
    await runContextMenuAction(
      "copy",
      { kind: "edit", target: el, readonly: false, selectionText: "", x: 0, y: 0, items: [] },
      deps,
    );
    expect(deps.copyText).toHaveBeenCalledWith("hello");
    expect(deps.notifyWarn).toHaveBeenCalledWith("ctx_copy_unavailable");
  });

  it("选区形态复制使用选中文本", async () => {
    const deps = makeDeps();
    await runContextMenuAction(
      "copy",
      { kind: "selection", target: null, readonly: false, selectionText: "world", x: 0, y: 0, items: [] },
      deps,
    );
    expect(deps.copyText).toHaveBeenCalledWith("world");
  });

  it("输入框全选覆盖整段文本", async () => {
    const el = makeTextarea("hello");
    await runContextMenuAction(
      "selectAll",
      { kind: "edit", target: el, readonly: false, selectionText: "", x: 0, y: 0, items: [] },
      makeDeps(),
    );
    expect(el.selectionStart).toBe(0);
    expect(el.selectionEnd).toBe(5);
  });
});
