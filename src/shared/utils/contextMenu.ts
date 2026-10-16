/**
 * @fileoverview contextMenu.ts
 * @description shared/utils｜统一右键菜单的请求解析、菜单模型与动作执行。
 *
 * 设计：
 * - 与 Vue 无关，便于在 jsdom 下单测（`document.execCommand` / `navigator.clipboard` 缺失时全部走守卫分支）；
 * - 「组件已接管」以 `event.defaultPrevented` 为信号（既有消息/频道/文件菜单都会 `preventDefault`）；
 * - 全局监听在冒泡阶段执行：默认动作（WebView2 原生菜单）在派发结束后才发生，因此冒泡阶段
 *   `preventDefault()` 即可屏蔽原生菜单，同时能准确读到 `defaultPrevented`。
 */

/** 菜单来源形态：输入区编辑菜单 / 选区菜单。 */
export type ContextMenuKind = "edit" | "selection";

/** 菜单动作键。 */
export type ContextMenuActionKey = "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll";

/** 菜单条目模型（文案由宿主按 `labelKey` 取 i18n）。 */
export type ContextMenuItemModel = {
  /** 动作键。 */
  key: ContextMenuActionKey;
  /** i18n 文案键。 */
  labelKey: string;
  /** 快捷键提示（仅展示）。 */
  shortcut?: string;
  /** 是否置灰。 */
  disabled?: boolean;
};

/** 一次右键解析结果（`open` 形态）。 */
export type ContextMenuRequest = {
  /** 菜单形态。 */
  kind: ContextMenuKind;
  /** 可编辑目标；选区形态为 `null`。 */
  target: HTMLElement | null;
  /** 是否只读可编辑元素（只允许复制/全选）。 */
  readonly: boolean;
  /** 当前选中文本（可能为空字符串）。 */
  selectionText: string;
  /** 期望左边缘 x（鼠标 clientX）。 */
  x: number;
  /** 期望上边缘 y（鼠标 clientY）。 */
  y: number;
  /** 菜单条目。 */
  items: ContextMenuItemModel[];
};

/** 右键解析结论。 */
export type ContextMenuResolution =
  /** 不干预：组件已接管，或 dev 下保留原生菜单。 */
  | { action: "ignore"; reason: "handled" | "native-escape" }
  /** 仅屏蔽原生菜单（无可用动作 / 右键落在菜单自身）。 */
  | { action: "none" }
  /** 打开菜单。 */
  | { action: "open"; request: ContextMenuRequest };

/** 动作执行依赖（由宿主注入，便于测试）。 */
export type ContextMenuDeps = {
  /** 是否具备读取剪贴板的能力（决定「粘贴」是否置灰）。 */
  canReadClipboard: () => boolean;
  /** 读取剪贴板文本（失败时抛错）。 */
  readClipboardText: () => Promise<string>;
  /** 文本写入剪贴板（失败时抛错或返回 false）。 */
  copyText: (text: string) => Promise<unknown>;
  /** 轻量警告提示（参数为 i18n 文案键）。 */
  notifyWarn: (messageKey: string) => void;
};

/** 菜单面板根类名（与 `ContextMenuSurface.vue` 的样式约定一致）。 */
export const CONTEXT_MENU_PANEL_CLASS = "cp-menu";

/** 非文本输入类型（右键不视为可编辑目标）。 */
const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "range",
  "file",
  "button",
  "submit",
  "reset",
  "image",
  "color",
  "hidden",
]);

/**
 * 是否为可编辑输入目标。
 *
 * @param el - 候选元素。
 * @returns 命中返回 `true`。
 */
export function isEditableElement(el: unknown): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? "text";
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return el.isContentEditable === true;
}

/**
 * dev 构建下 `Shift+右键` 保留原生菜单（调试用逃生舱）。
 *
 * @param e - 鼠标事件。
 * @returns 需要保留原生菜单返回 `true`。
 */
export function isNativeMenuEscape(e: MouseEvent): boolean {
  return import.meta.env.DEV === true && e.shiftKey === true;
}

/**
 * 当前全局选中文本。
 *
 * @returns 选中文本（无选区返回空字符串）。
 */
function currentSelectionText(): string {
  try {
    return window.getSelection()?.toString() ?? "";
  } catch {
    return "";
  }
}

/**
 * 从事件路径中取出可编辑目标（支持 shadow DOM）。
 *
 * @param path - `event.composedPath()` 结果。
 * @returns 首个可编辑元素；未命中返回 `null`。
 */
function findEditableTarget(path: EventTarget[]): HTMLElement | null {
  for (const node of path) {
    if (isEditableElement(node)) return node;
  }
  return null;
}

/**
 * 判断路径是否包含菜单面板（右键落在菜单自身）。
 *
 * @param path - `event.composedPath()` 结果。
 * @returns 命中返回 `true`。
 */
function isMenuPanelInPath(path: EventTarget[]): boolean {
  for (const node of path) {
    const el = node as Partial<Element> | null;
    if (el && typeof el === "object" && el.classList?.contains(CONTEXT_MENU_PANEL_CLASS)) {
      return true;
    }
  }
  return false;
}

/**
 * 可编辑元素是否不可用（禁用或被 inert 容器包裹）。
 *
 * @param el - 可编辑元素。
 * @returns 不可用返回 `true`。
 */
function isUnusableEditable(el: HTMLElement): boolean {
  if ((el as HTMLInputElement).disabled === true) return true;
  return el.closest("[inert]") !== null;
}

/**
 * 可编辑元素是否只读。
 *
 * @param el - 可编辑元素。
 * @returns 只读返回 `true`。
 */
function isReadonlyEditable(el: HTMLElement): boolean {
  return (el as HTMLInputElement).readOnly === true;
}

/**
 * 文本类输入框当前是否有选区。
 *
 * @param el - 可编辑元素。
 * @param selectionText - 全局选中文本。
 * @returns 有选区返回 `true`。
 */
function hasEditableSelection(el: HTMLElement, selectionText: string): boolean {
  const start = (el as HTMLInputElement).selectionStart;
  const end = (el as HTMLInputElement).selectionEnd;
  if (typeof start === "number" && typeof end === "number") return start !== end;
  if (el.isContentEditable) return selectionText.trim().length > 0;
  return false;
}

/**
 * 可编辑元素是否已有内容（决定「全选」是否可用）。
 *
 * @param el - 可编辑元素。
 * @returns 有内容返回 `true`。
 */
function hasEditableContent(el: HTMLElement): boolean {
  if (el.isContentEditable) return (el.textContent ?? "").length > 0;
  return (el as HTMLInputElement).value.length > 0;
}

/**
 * 传入的剪贴板读取通道是否映射到浏览器 Clipboard API。
 *
 * @returns 可用返回 `true`。
 */
function defaultCanReadClipboard(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";
  } catch {
    return false;
  }
}

/**
 * 命令是否可用（`queryCommandEnabled` 缺失或抛错时默认可用）。
 *
 * @param command - 命令名（`undo` / `redo`）。
 * @returns 可用返回 `true`。
 */
function isCommandEnabled(command: string): boolean {
  const query = (document as Document & { queryCommandEnabled?: (c: string) => boolean })
    .queryCommandEnabled;
  if (typeof query !== "function") return true;
  try {
    return query.call(document, command) !== false;
  } catch {
    return true;
  }
}

/**
 * 快捷键提示文案。
 *
 * @param key - 动作键。
 * @param isMac - 是否 macOS 平台。
 * @returns 提示字符串。
 */
export function getShortcutHint(key: ContextMenuActionKey, isMac = false): string {
  if (isMac) {
    const map: Record<ContextMenuActionKey, string> = {
      undo: "⌘Z",
      redo: "⇧⌘Z",
      cut: "⌘X",
      copy: "⌘C",
      paste: "⌘V",
      selectAll: "⌘A",
    };
    return map[key];
  }
  const map: Record<ContextMenuActionKey, string> = {
    undo: "Ctrl+Z",
    redo: "Ctrl+Y",
    cut: "Ctrl+X",
    copy: "Ctrl+C",
    paste: "Ctrl+V",
    selectAll: "Ctrl+A",
  };
  return map[key];
}

/**
 * 是否 macOS 平台（仅用于快捷键提示展示）。
 *
 * @returns macOS 返回 `true`。
 */
export function isMacPlatform(): boolean {
  try {
    return /mac/i.test(navigator.userAgent ?? "");
  } catch {
    return false;
  }
}

/**
 * 构建输入区编辑菜单条目。
 *
 * @param input.target - 可编辑元素。
 * @param input.readonly - 是否只读。
 * @param input.selectionText - 全局选中文本。
 * @param input.canPaste - 是否具备剪贴板读取能力。
 * @param input.isMac - 是否 macOS。
 * @returns 菜单条目。
 */
export function buildEditMenuItems(input: {
  target: HTMLElement;
  readonly: boolean;
  selectionText: string;
  canPaste: boolean;
  isMac: boolean;
}): ContextMenuItemModel[] {
  const { target, readonly, canPaste, isMac } = input;
  const hasSelection = hasEditableSelection(target, input.selectionText);
  return [
    {
      key: "undo",
      labelKey: "ctx_undo",
      shortcut: getShortcutHint("undo", isMac),
      disabled: readonly || !isCommandEnabled("undo"),
    },
    {
      key: "redo",
      labelKey: "ctx_redo",
      shortcut: getShortcutHint("redo", isMac),
      disabled: readonly || !isCommandEnabled("redo"),
    },
    {
      key: "cut",
      labelKey: "ctx_cut",
      shortcut: getShortcutHint("cut", isMac),
      disabled: readonly || !hasSelection,
    },
    {
      key: "copy",
      labelKey: "ctx_copy",
      shortcut: getShortcutHint("copy", isMac),
      disabled: !hasSelection,
    },
    {
      key: "paste",
      labelKey: "ctx_paste",
      shortcut: getShortcutHint("paste", isMac),
      disabled: readonly || !canPaste,
    },
    {
      key: "selectAll",
      labelKey: "ctx_select_all",
      shortcut: getShortcutHint("selectAll", isMac),
      disabled: !hasEditableContent(target),
    },
  ];
}

/**
 * 构建选区（非输入区）菜单条目。
 *
 * @param isMac - 是否 macOS。
 * @returns 菜单条目。
 */
export function buildSelectionMenuItems(isMac: boolean): ContextMenuItemModel[] {
  return [
    {
      key: "copy",
      labelKey: "ctx_copy",
      shortcut: getShortcutHint("copy", isMac),
    },
    {
      key: "selectAll",
      labelKey: "ctx_select_all",
      shortcut: getShortcutHint("selectAll", isMac),
    },
  ];
}

/**
 * 解析一次右键事件：是否需要屏蔽原生菜单、是否需要打开菜单。
 *
 * @param e - 鼠标右键事件。
 * @param options.canReadClipboard - 剪贴板读取能力探测（默认探测 `navigator.clipboard.readText`）。
 * @param options.isMac - 是否 macOS（默认自动探测）。
 * @param options.isDev - 是否为 dev 构建（默认读取 `import.meta.env.DEV`）。
 * @returns 解析结论；`ignore` 时调用方不得 `preventDefault`。
 */
export function resolveContextMenuEvent(
  e: MouseEvent,
  options?: {
    canReadClipboard?: () => boolean;
    isMac?: boolean;
    isDev?: boolean;
  },
): ContextMenuResolution {
  if (e.defaultPrevented) return { action: "ignore", reason: "handled" };
  const isDev = options?.isDev ?? import.meta.env.DEV === true;
  if (isDev && e.shiftKey) return { action: "ignore", reason: "native-escape" };

  const path = typeof e.composedPath === "function" ? e.composedPath() : [];
  if (isMenuPanelInPath(path)) return { action: "none" };

  const isMac = options?.isMac ?? isMacPlatform();
  const canPaste = (options?.canReadClipboard ?? defaultCanReadClipboard)();
  const selectionText = currentSelectionText();
  const target = findEditableTarget(path);

  if (target && !isUnusableEditable(target)) {
    const readonly = isReadonlyEditable(target);
    return {
      action: "open",
      request: {
        kind: "edit",
        target,
        readonly,
        selectionText,
        x: e.clientX,
        y: e.clientY,
        items: buildEditMenuItems({ target, readonly, selectionText, canPaste, isMac }),
      },
    };
  }

  if (selectionText.trim().length > 0) {
    return {
      action: "open",
      request: {
        kind: "selection",
        target: null,
        readonly: false,
        selectionText,
        x: e.clientX,
        y: e.clientY,
        items: buildSelectionMenuItems(isMac),
      },
    };
  }

  return { action: "none" };
}

/**
 * 执行浏览器编辑命令（命令不可用时返回 `false`）。
 *
 * @param command - 命令名。
 * @param value - 命令参数（如 `insertText` 的文本）。
 * @returns 命中并成功返回 `true`。
 */
function execCommand(command: string, value?: string): boolean {
  const exec = (
    document as Document & { execCommand?: (c: string, ui: boolean, v?: string) => boolean }
  ).execCommand;
  if (typeof exec !== "function") return false;
  try {
    return Boolean(document.execCommand(command, false, value));
  } catch {
    return false;
  }
}

/**
 * 聚焦可编辑元素（不滚动视口）。
 *
 * @param el - 目标元素。
 * @returns 无返回值。
 */
function focusTarget(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: true });
  } catch {
    /* 聚焦失败不影响后续命令（命令不可用时走回退路径） */
  }
}

/**
 * 读取文本类输入框当前选中的文本。
 *
 * @param el - 输入框元素。
 * @returns 选中文本。
 */
function readInputSelection(el: HTMLElement): string {
  const input = el as HTMLInputElement;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (typeof start !== "number" || typeof end !== "number") return "";
  return input.value.slice(Math.min(start, end), Math.max(start, end));
}

/**
 * 回退插入文本：`setRangeText` + 手动派发 `input`（保持 v-model 同步）。
 *
 * @param el - 可编辑元素。
 * @param text - 待插入文本。
 * @returns 无返回值。
 */
function insertTextFallback(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.setRangeText(text, start, end, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  // contenteditable：在当前位置插入文本节点
  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range) return;
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  selection?.collapseToEnd();
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * 执行菜单动作。
 *
 * @param key - 动作键。
 * @param request - 右键解析结果。
 * @param deps - 依赖注入（剪贴板读写与提示）。
 * @returns 动作完成后的 Promise。
 */
export async function runContextMenuAction(
  key: ContextMenuActionKey,
  request: ContextMenuRequest,
  deps: ContextMenuDeps,
): Promise<void> {
  const target = request.target;
  try {
    switch (key) {
      case "undo":
      case "redo":
        if (!target) return;
        focusTarget(target);
        execCommand(key);
        return;
      case "cut":
        if (!target) return;
        focusTarget(target);
        execCommand("cut");
        return;
      case "copy": {
        if (target) {
          focusTarget(target);
          if (execCommand("copy")) return;
          const text = readInputSelection(target);
          if (!text) return;
          if ((await deps.copyText(text)) === false) deps.notifyWarn("ctx_copy_unavailable");
          return;
        }
        if (!request.selectionText) return;
        if ((await deps.copyText(request.selectionText)) === false) {
          deps.notifyWarn("ctx_copy_unavailable");
        }
        return;
      }
      case "paste": {
        if (!target) return;
        focusTarget(target);
        const text = await deps.readClipboardText();
        if (!text) return;
        if (execCommand("insertText", text)) return;
        insertTextFallback(target, text);
        return;
      }
      case "selectAll": {
        if (target) {
          focusTarget(target);
          if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
            target.select();
            return;
          }
          execCommand("selectAll");
          return;
        }
        window.getSelection()?.selectAllChildren(document.body);
        return;
      }
    }
  } catch {
    deps.notifyWarn(key === "copy" ? "ctx_copy_unavailable" : "ctx_paste_unavailable");
  }
}
