/**
 * @fileoverview channelMessageProjection 单测。
 * @description
 * 覆盖频道消息 → 插件只读投影的过滤与裁剪规则：
 * 撤回/空内容过滤、文本与 preview 投影、发送者名回退、取最近 N 条、truncated 与 totalCount，
 * 以及聊天多选 id → 可参与总结 id 的收敛（时间线顺序、去重、丢弃不可用条目）。
 */

import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { PluginChannelMessage } from "@/features/plugins/api-types";
import {
  MAX_PLUGIN_CHANNEL_MESSAGES,
  intersectSelectedIds,
  projectChannelMessages,
} from "./channelMessageProjection";

/**
 * 构造文本消息。
 *
 * @param id - 消息 id。
 * @param text - 正文。
 * @param options - 可选的发送者与撤回标记。
 * @returns 渲染用消息。
 */
function textMessage(
  id: string,
  text: string,
  options: { name?: string; senderId?: string; recalledAt?: number } = {},
): ChatMessage {
  return {
    id,
    kind: "core_text",
    from: { id: options.senderId ?? "u1", name: options.name ?? "Alice" },
    timeMs: Number(id.replace(/\D/gu, "")) || 1,
    domain: { id: "Core:Text" },
    text,
    ...(options.recalledAt != null ? { recalledAt: options.recalledAt } : {}),
  } as unknown as ChatMessage;
}

describe("projectChannelMessages", () => {
  it("projects core_text body and keeps timeline order", () => {
    const result = projectChannelMessages([textMessage("m1", "第一条"), textMessage("m2", "第二条")], 500);

    expect(result.messages.map((m) => m.text)).toEqual(["第一条", "第二条"]);
    expect(result.messages[0]).toMatchObject({ messageId: "m1", senderId: "u1", senderName: "Alice" });
    expect(result.truncated).toBe(false);
    expect(result.totalCount).toBe(2);
  });

  it("drops recalled messages and blank projections", () => {
    const result = projectChannelMessages(
      [
        textMessage("m1", "保留"),
        textMessage("m2", "已撤回", { recalledAt: 123 }),
        textMessage("m3", "   "),
      ],
      500,
    );

    expect(result.messages.map((m) => m.text)).toEqual(["保留"]);
    // 过滤发生在裁剪之前：totalCount 仍是时间线条数。
    expect(result.totalCount).toBe(3);
  });

  it("falls back to [Image]/[Video] placeholders when preview is empty", () => {
    const image = {
      id: "m1",
      kind: "image",
      from: { id: "u1", name: "Alice" },
      timeMs: 1,
      domain: { id: "Core:Image" },
      preview: "",
      fileName: "photo.png",
    } as unknown as ChatMessage;
    const video = {
      id: "m2",
      kind: "video",
      from: { id: "u2", name: "Bob" },
      timeMs: 2,
      domain: { id: "Core:Video" },
      preview: "",
      fileName: "clip.mp4",
    } as unknown as ChatMessage;

    expect(projectChannelMessages([image, video], 500).messages.map((m) => m.text)).toEqual([
      "[Image] photo.png",
      "[Video] clip.mp4",
    ]);
  });

  it("uses domain preview text as-is", () => {
    const domain = {
      id: "m1",
      kind: "domain_message",
      from: { id: "u1", name: "Alice" },
      timeMs: 1,
      domain: { id: "markdown" },
      preview: "**bold**",
    } as unknown as ChatMessage;

    expect(projectChannelMessages([domain], 500).messages[0]?.text).toBe("**bold**");
  });

  it("falls back to sender id when name is empty", () => {
    const result = projectChannelMessages([textMessage("m1", "hi", { name: "", senderId: "u9" })], 500);

    expect(result.messages[0]?.senderName).toBe("u9");
  });

  it("keeps only the newest N messages and reports truncation", () => {
    const messages = [1, 2, 3, 4, 5].map((i) => textMessage(`m${i}`, `msg-${i}`));

    const result = projectChannelMessages(messages, 2);

    expect(result.messages.map((m) => m.messageId)).toEqual(["m4", "m5"]);
    expect(result.truncated).toBe(true);
    expect(result.totalCount).toBe(5);
  });

  it("clamps non-positive limit to one message and defaults invalid input to the cap", () => {
    const messages = [1, 2, 3].map((i) => textMessage(`m${i}`, `msg-${i}`));

    expect(projectChannelMessages(messages, 0).messages.map((m) => m.messageId)).toEqual(["m3"]);
    expect(projectChannelMessages(messages, Number.NaN).messages).toHaveLength(3);
    expect(MAX_PLUGIN_CHANNEL_MESSAGES).toBe(500);
  });
});

describe("intersectSelectedIds", () => {
  /**
   * 构造已投影消息。
   *
   * @param id - 消息 id。
   * @returns 插件可见消息。
   */
  function projected(id: string): PluginChannelMessage {
    return { messageId: id, senderId: "u1", senderName: "Alice", timeMs: 1, text: `text-${id}` };
  }

  it("keeps timeline order regardless of selection order", () => {
    const result = intersectSelectedIds([projected("m1"), projected("m2"), projected("m3")], ["m3", "m1"]);

    expect(result).toEqual(["m1", "m3"]);
  });

  it("drops selection ids that are missing from the snapshot", () => {
    // 被撤回/投影过滤掉、或早于 500 条裁剪边界的选中项不会出现在 messages 里。
    const result = intersectSelectedIds([projected("m1")], ["m1", "recalled", "too-old"]);

    expect(result).toEqual(["m1"]);
  });

  it("ignores blank and duplicate ids", () => {
    const result = intersectSelectedIds([projected("m1"), projected("m1")], ["  ", "m1", "m1"]);

    expect(result).toEqual(["m1"]);
  });

  it("returns an empty list when nothing is selected", () => {
    expect(intersectSelectedIds([projected("m1")], [])).toEqual([]);
    expect(intersectSelectedIds([projected("m1")], ["  "])).toEqual([]);
  });
});
