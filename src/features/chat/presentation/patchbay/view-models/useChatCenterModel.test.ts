/**
 * @fileoverview useChatCenterModel.test.ts
 * @description chat｜view-model：ChatCenter 消息行作者名兜底解析的集成验证。
 *
 * 覆盖链路：服务端信封不带昵称 → mapper 生成 `用户 <uid>` 占位名 →
 * 行投影按 uid 补拉公开资料（debounce 批量）→ 缓存更新后投影自动重算为真实昵称。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import type { ChatMessage, MessageTimelineSnapshot } from "@/features/chat/message-flow/api-types";
import type { ChatCenterModel } from "./useChatCenterModel";
import { useChatCenterModel } from "./useChatCenterModel";

/** 最小 capability 桩：可读取、可推送新快照；未实现的方法统一退化为 no-op。 */
function capability<T>(initial: T) {
  let snapshot = initial;
  let observer: ((next: T) => void) | null = null;
  const base = {
    getSnapshot: () => snapshot,
    observeSnapshot: (fn: (next: T) => void) => {
      observer = fn;
      return () => {
        observer = null;
      };
    },
    push: (next: T) => {
      snapshot = next;
      observer?.(next);
    },
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return Reflect.get(target, prop);
      return () => undefined;
    },
  });
}

function timelineSnapshot(messages: ChatMessage[]): MessageTimelineSnapshot {
  return {
    currentMessages: messages,
    currentMessageCount: messages.length,
    hasMoreHistory: false,
    isLoadingHistory: false,
    search: { query: "", loading: false, error: "", results: [] },
    highlightedMessageId: "",
  };
}

/** 一条昵称缺失（mapper 占位名）的消息。 */
function placeholderMessage(): ChatMessage {
  return {
    id: "m1",
    kind: "core_text",
    from: { id: "1001", name: "用户 1001" },
    timeMs: 1000,
    domain: { id: "Core:System", label: "Core:System", colorVar: "--cp-domain-core" },
    text: "",
  };
}

/**
 * 构造一条测试消息（仅覆盖分组投影关心的字段）。
 *
 * @param id - 消息 id。
 * @param fromId - 发送者 uid。
 * @param timeMs - 消息时间戳。
 * @returns 测试用消息。
 */
function makeMessage(id: string, fromId: string, timeMs: number): ChatMessage {
  return {
    id,
    kind: "core_text",
    from: { id: fromId, name: `用户 ${fromId}` },
    timeMs,
    domain: { id: "Core:System", label: "Core:System", colorVar: "--cp-domain-core" },
    text: "",
  };
}

type CenterOptions = {
  messages?: ChatMessage[];
  resolveSenderName?: (uid: string) => string;
  fetchUserNames?: (uids: string[]) => Promise<Record<string, string>>;
};

/**
 * 挂载一个只消费 useChatCenterModel 的宿主组件。
 *
 * @returns 模型实例与补拉 spy。
 */
function mountCenter(options: CenterOptions = {}): {
  model: ChatCenterModel;
  fetchUserNames: ReturnType<typeof vi.fn>;
  loadContextAroundMessage: ReturnType<typeof vi.fn>;
  clearHighlightedMessage: ReturnType<typeof vi.fn>;
  selectChannel: ReturnType<typeof vi.fn>;
  timeline: ReturnType<typeof capability<MessageTimelineSnapshot>>;
} {
  const timelineBase = capability<MessageTimelineSnapshot>(timelineSnapshot(options.messages ?? [placeholderMessage()]));
  const clearHighlightedMessage = vi.fn(() => {
    timelineBase.push({ ...timelineBase.getSnapshot(), highlightedMessageId: "" });
  });
  // 模拟真实语义：定位成功后 store 高亮目标消息。
  const loadContextAroundMessage = vi.fn(async (mid: string) => {
    timelineBase.push({ ...timelineBase.getSnapshot(), highlightedMessageId: mid });
  });
  const timeline = Object.assign(timelineBase, { loadContextAroundMessage, clearHighlightedMessage });
  const session = capability({
    currentChannelId: "cid-1",
    lastReadMessageId: "",
    lastReadTimeMs: 0,
  });
  const composer = capability({
    draft: "",
    activeDomainId: "Core:Text",
    replyToMessageId: "",
    replyDraft: null,
    draftMentions: [],
    actionError: null,
    availableDomains: [],
  });
  const fetchUserNames = vi.fn(options.fetchUserNames ?? (async () => ({})));
  const selectChannel = vi.fn(async () => {});

  const deps = {
    currentSession: session,
    currentTimeline: timeline,
    messageComposer: composer,
    lookupChannel: () => ({ findMessageById: () => null }),
    currentUserId: ref("1002"),
    currentUserRole: ref("member"),
    currentChannelName: ref("system"),
    connectionDetail: ref(""),
    connectionPillState: ref("connected"),
    retryConnection: async () => ({ ok: true, kind: "server_workspace_connected" }),
    domainRegistryView: ref(null),
    onLoadMoreMessages: () => {},
    onMessageContextMenu: () => {},
    onForwardMessage: async () => {},
    selectChannel,
    resolveSenderName: options.resolveSenderName ?? (() => ""),
    fetchUserNames,
  };

  let model: ChatCenterModel | null = null;
  const Harness = defineComponent({
    setup() {
      model = useChatCenterModel(deps as never);
      return () => null;
    },
  });
  wrapper = mount(Harness, {
    global: {
      plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn: {} } })],
    },
  });
  return { model: model as unknown as ChatCenterModel, fetchUserNames, loadContextAroundMessage, clearHighlightedMessage, selectChannel, timeline };
}

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.useRealTimers();
});

describe("useChatCenterModel 作者名解析", () => {
  it("批量补拉昵称后，消息行发送者名从占位名变为真实昵称", async () => {
    const { model, fetchUserNames } = mountCenter({
      fetchUserNames: async (uids) => Object.fromEntries(uids.map((uid) => [uid, uid === "1001" ? "系统" : ""])),
    });

    expect(model.messageRows[0].m.from.name).toBe("用户 1001");

    // debounce 批量补拉 → 缓存更新 → 行投影重算
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    expect(fetchUserNames).toHaveBeenCalledWith(["1001"]);
    expect(model.messageRows[0].m.from.name).toBe("系统");
  });

  it("成员目录已能解析时不发起补拉", async () => {
    const { model, fetchUserNames } = mountCenter({
      resolveSenderName: (uid) => (uid === "1001" ? "系统" : ""),
    });

    expect(model.messageRows[0].m.from.name).toBe("系统");

    await vi.advanceTimersByTimeAsync(300);
    expect(fetchUserNames).not.toHaveBeenCalled();
  });

  it("补拉无结果时保留占位名且不重复请求", async () => {
    const { model, fetchUserNames } = mountCenter({ fetchUserNames: async () => ({}) });

    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);
    await nextTick();

    expect(fetchUserNames).toHaveBeenCalledTimes(1);
    expect(model.messageRows[0].m.from.name).toBe("用户 1001");
  });
});

describe("useChatCenterModel 消息分组投影", () => {
  it("同一发送者半天内的连续消息归为一组，仅首条为组首", () => {
    const base = 1_700_000_000_000;
    const { model } = mountCenter({
      messages: [
        makeMessage("m1", "1001", base),
        makeMessage("m2", "1001", base + 60 * 1000),
        makeMessage("m3", "1001", base + 2 * 60 * 60 * 1000),
      ],
    });

    expect(model.messageRows.map((row) => row.isGroupStart)).toEqual([true, false, false]);
    expect(model.messageRows.map((row) => row.showDate)).toEqual([false, false, false]);
  });

  it("发送者变化或时间差达到半天时开启新组", () => {
    const base = 1_700_000_000_000;
    const { model } = mountCenter({
      messages: [
        makeMessage("m1", "1001", base),
        makeMessage("m2", "1002", base + 1000),
        makeMessage("m3", "1002", base + 13 * 60 * 60 * 1000),
      ],
    });

    expect(model.messageRows.map((row) => row.isGroupStart)).toEqual([true, true, true]);
  });

  it("单条消息仍为组首（回归）", () => {
    const { model } = mountCenter();

    expect(model.messageRows).toHaveLength(1);
    expect(model.messageRows[0].isGroupStart).toBe(true);
    expect(model.messageRows[0].showDate).toBe(false);
  });
});

describe("useChatCenterModel 消息定位", () => {
  it("跳转到被引用消息时加载其上下文并发出定位请求", async () => {
    const { model, loadContextAroundMessage } = mountCenter();

    await model.jumpToReferencedMessage("m0");

    expect(loadContextAroundMessage).toHaveBeenCalledWith("m0");
    expect(model.messageReveal.messageId).toBe("m0");
    expect(model.messageReveal.nonce).toBe(1);
  });

  it("重复跳转同一条消息时刷新定位请求（nonce 递增）", async () => {
    const { model } = mountCenter();

    await model.jumpToReferencedMessage("m0");
    const first = model.messageReveal;
    await model.jumpToReferencedMessage("m0");

    expect(model.messageReveal.nonce).toBe(2);
    expect(model.messageReveal).not.toBe(first);
  });

  it("空消息 id 不加载上下文也不发出定位请求", async () => {
    const { model, loadContextAroundMessage } = mountCenter();

    await model.jumpToReferencedMessage("   ");

    expect(loadContextAroundMessage).not.toHaveBeenCalled();
    expect(model.messageReveal.messageId).toBe("");
    expect(model.messageReveal.nonce).toBe(0);
  });
});

describe("useChatCenterModel 定位高亮自动清除", () => {
  it("跳转后高亮在超时后被清除", async () => {
    const { model, timeline, clearHighlightedMessage } = mountCenter();

    await model.jumpToReferencedMessage("m0");
    expect(timeline.getSnapshot().highlightedMessageId).toBe("m0");

    await vi.advanceTimersByTimeAsync(2600);

    expect(clearHighlightedMessage).toHaveBeenCalledTimes(1);
    expect(timeline.getSnapshot().highlightedMessageId).toBe("");
  });

  it("连续跳转时只清除最后一次目标，不误伤新高亮", async () => {
    const { model, timeline, clearHighlightedMessage } = mountCenter();

    await model.jumpToReferencedMessage("m0");
    await vi.advanceTimersByTimeAsync(1000);
    await model.jumpToReferencedMessage("m1");
    // 第一次调度的 2600ms 到期：此时高亮已是 m1，不应被提前抹掉。
    await vi.advanceTimersByTimeAsync(1600);
    expect(timeline.getSnapshot().highlightedMessageId).toBe("m1");
    expect(clearHighlightedMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(clearHighlightedMessage).toHaveBeenCalledTimes(1);
    expect(timeline.getSnapshot().highlightedMessageId).toBe("");
  });

  it("高亮目标与本次定位不一致时不清除", async () => {
    const { model, timeline, clearHighlightedMessage } = mountCenter();

    await model.jumpToReferencedMessage("m0");
    // 模拟期间高亮被其它链路改写。
    timeline.push({ ...timeline.getSnapshot(), highlightedMessageId: "mX" });

    await vi.advanceTimersByTimeAsync(2600);

    expect(clearHighlightedMessage).not.toHaveBeenCalled();
    expect(timeline.getSnapshot().highlightedMessageId).toBe("mX");
  });
});
