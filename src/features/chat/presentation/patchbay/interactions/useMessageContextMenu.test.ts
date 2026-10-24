/**
 * @fileoverview useMessageContextMenu.test.ts
 * @description chat｜interactions：消息右键菜单与消息引用块右键菜单的状态/动作分发验证。
 */

import { describe, expect, it, vi } from "vitest";
import type { RecallChatMessageOutcome } from "@/features/chat/message-flow/api-types";
import { useMessageContextMenu } from "./useMessageContextMenu";

/**
 * 构造最小依赖桩，并记录各动作调用。
 *
 * @returns 菜单模型与 spy 集合。
 */
function setup() {
  const spies = {
    startReply: vi.fn(),
    jumpToReferencedMessage: vi.fn(),
    getClipboardText: vi.fn(() => "hello"),
    copyTextToClipboard: vi.fn(async () => true),
    recallMessage: vi.fn(async (): Promise<RecallChatMessageOutcome> => ({ ok: true, kind: "chat_message_recalled", messageId: "m1" })),
    onAsyncError: vi.fn(),
    enterMultiSelectMode: vi.fn(),
    openForwardDialog: vi.fn(),
    pinMessage: vi.fn(async () => {}),
    unpinMessage: vi.fn(async () => {}),
    bookmarkMessage: vi.fn(),
    unbookmarkMessage: vi.fn(),
  };
  const model = useMessageContextMenu(spies);
  return { model, spies };
}

/** 伪造鼠标右键事件（仅需 clientX/clientY/preventDefault）。 */
function mouseEvent(x = 12, y = 34): MouseEvent {
  return { clientX: x, clientY: y, preventDefault: vi.fn() } as unknown as MouseEvent;
}

describe("useMessageContextMenu 消息菜单", () => {
  it("右键消息时进入消息菜单形态并记录坐标", () => {
    const { model } = setup();

    model.handleMessageContextMenu(mouseEvent(10, 20), "m1");

    expect(model.menuOpen.value).toBe(true);
    expect(model.menuMode.value).toBe("message");
    expect(model.menuMessageId.value).toBe("m1");
    expect(model.menuX.value).toBe(10);
    expect(model.menuY.value).toBe(20);
  });

  it("回复动作派发给消息 id", () => {
    const { model, spies } = setup();

    model.handleMessageContextMenu(mouseEvent(), "m1");
    model.handleMenuAction("reply");

    expect(spies.startReply).toHaveBeenCalledWith("m1");
  });
});

describe("useMessageContextMenu 引用块菜单", () => {
  it("右键引用块时进入引用菜单形态并记录被引用消息 id", () => {
    const { model } = setup();
    const event = mouseEvent(5, 6);

    model.handleReferenceContextMenu(event, "m0");

    expect(event.preventDefault).toHaveBeenCalled();
    expect(model.menuOpen.value).toBe(true);
    expect(model.menuMode.value).toBe("reference");
    expect(model.menuReferenceMessageId.value).toBe("m0");
    // 引用菜单不针对消息本身，避免消息菜单的条件项误判。
    expect(model.menuMessageId.value).toBe("");
    expect(model.menuX.value).toBe(5);
    expect(model.menuY.value).toBe(6);
  });

  it("jump 动作跳转到被引用消息，而不是当前消息", () => {
    const { model, spies } = setup();

    model.handleReferenceContextMenu(mouseEvent(), "m0");
    model.handleMenuAction("jump");

    // 同频道引用不携带 channelId（第二个参数为 undefined）。
    expect(spies.jumpToReferencedMessage).toHaveBeenCalledWith("m0", undefined);
    expect(spies.startReply).not.toHaveBeenCalled();
    expect(spies.enterMultiSelectMode).not.toHaveBeenCalled();
  });

  it("空引用 id 不打开菜单", () => {
    const { model } = setup();

    model.handleReferenceContextMenu(mouseEvent(), "  ");

    expect(model.menuOpen.value).toBe(false);
  });

  it("回到消息菜单后 jump 不再命中上一次的引用目标", () => {
    const { model, spies } = setup();

    model.handleReferenceContextMenu(mouseEvent(), "m0");
    model.handleMessageContextMenu(mouseEvent(), "m9");
    model.handleMenuAction("jump");

    expect(spies.jumpToReferencedMessage).not.toHaveBeenCalled();
  });
});

describe("useMessageContextMenu 转发来源块菜单", () => {
  it("右键转发来源（携带源频道 id）进入 forward 菜单形态", () => {
    const { model } = setup();

    model.handleReferenceContextMenu(mouseEvent(7, 8), "src-1", "c-origin");

    expect(model.menuOpen.value).toBe(true);
    expect(model.menuMode.value).toBe("forward");
    expect(model.menuReferenceMessageId.value).toBe("src-1");
    expect(model.menuReferenceChannelId.value).toBe("c-origin");
    expect(model.menuMessageId.value).toBe("");
  });

  it("jump 动作携带源频道 id 跳转（跨频道转发）", () => {
    const { model, spies } = setup();

    model.handleReferenceContextMenu(mouseEvent(), "src-1", "c-origin");
    model.handleMenuAction("jump");

    expect(spies.jumpToReferencedMessage).toHaveBeenCalledWith("src-1", "c-origin");
  });

  it("回到引用菜单后 jump 不再携带上一次的源频道 id", () => {
    const { model, spies } = setup();

    model.handleReferenceContextMenu(mouseEvent(), "src-1", "c-origin");
    model.handleReferenceContextMenu(mouseEvent(), "m0");
    model.handleMenuAction("jump");

    expect(spies.jumpToReferencedMessage).toHaveBeenCalledWith("m0", undefined);
  });
});
