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
} {
  const timeline = capability<MessageTimelineSnapshot>(timelineSnapshot(options.messages ?? [placeholderMessage()]));
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
    selectChannel: async () => {},
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
  return { model: model as unknown as ChatCenterModel, fetchUserNames };
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
