/**
 * @fileoverview ChatCenter.test.ts
 * @description chat｜layout：消息行 domain 色条可见性契约（组内非首条隐藏色条、仅保留槽位列宽）。
 *
 * 说明：`@tanstack/vue-virtual` 在 jsdom 下拿不到 scrollRect，`getVirtualItems()` 恒为空数组，
 * 行根本不会渲染；因此这里桩掉虚拟滚动，只验证「组首 / 组内」与色条可见性标记的对应关系。
 * 真实样式（`visibility: hidden` + 组内 12px 内间距）在参考样式与视觉走查中核对。
 */

import { computed, proxyRefs, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import ChatCenter from "./ChatCenter.vue";
import { projectMessageRows } from "@/features/chat/presentation/patchbay/view-models/messageRowProjection";
import type { ChatCenterModel } from "@/features/chat/presentation/patchbay/view-models/useChatCenterModel";
import type { ChatMessage } from "@/features/chat/message-flow/domain/contracts";

/** 桩：让虚拟滚动一次性返回全部行，便于断言行级标记。 */
vi.mock("@tanstack/vue-virtual", () => ({
  useVirtualizer: (options: { value: { count: number } }) =>
    computed(() => ({
      getTotalSize: () => 0,
      scrollToIndex: () => undefined,
      measureElement: () => undefined,
      getVirtualItems: () =>
        Array.from({ length: options.value.count }, (_unused, index) => ({
          index,
          key: `item-${index}`,
          start: index * 40,
          size: 40,
        })),
    })),
}));

/**
 * 构造一条 Core:Text 消息。
 *
 * @param id - 消息 id。
 * @param timeMs - 发送时间戳。
 * @returns 测试用消息。
 */
function makeMessage(id: string, timeMs: number): ChatMessage {
  return {
    id,
    kind: "core_text",
    from: { id: "u-1", name: "Operator" },
    timeMs,
    domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
    text: "hi",
  };
}

/**
 * 用真实分组投影（半天窗口）构造行模型。
 *
 * @param messages - 按时间正序的消息列表。
 * @returns 与 `messages` 等长的行模型数组。
 */
function makeRows(messages: readonly ChatMessage[]) {
  const projections = projectMessageRows(messages);
  return messages.map((m, idx) => ({
    m,
    isGroupStart: projections[idx].isGroupStart,
    showDate: projections[idx].showDate,
  }));
}

/**
 * 构造满足 ChatCenter 渲染所需字段的页面模型桩。
 *
 * 说明：`useChatCenterModel` 对外返回 `proxyRefs(rawModel)`，模板里 `props.model.xxx` 取到的
 * 已是解包值（`ChatCenterModel = ShallowUnwrapRef<...>`），因此这里同样用 `proxyRefs` 包装。
 *
 * @param messages - 消息列表（时间正序）。
 * @returns 页面模型桩。
 */
function makeModel(messages: readonly ChatMessage[]): ChatCenterModel {
  const rows = computed(() => makeRows(messages));
  const model = {
    currentChannelId: computed(() => "cid-prod"),
    currentChannelName: computed(() => "General"),
    currentChannelHasMore: computed(() => false),
    loadingMoreMessages: computed(() => false),
    messageRows: rows,
    currentUserId: computed(() => "u-1"),
    selectedDomainId: computed(() => "Core:Text"),
    composerDraft: computed(() => ""),
    replyToMessageId: computed(() => ""),
    replyPreview: computed(() => ({ title: "", snippet: "" })),
    messageActionError: computed(() => ""),
    domainOptions: computed(() => []),
    activePluginComposer: computed(() => null),
    activePluginContext: computed(() => null),
    mentionCandidates: computed(() => []),
    mentionMenuOpen: computed(() => false),
    currentUserRole: computed(() => "owner"),
    quoteReplyDraft: computed(() => null),
    linkPreview: computed(() => null),
    highlightedMessageId: computed(() => ""),
    multiSelectMode: computed(() => false),
    searchPanelOpen: computed(() => false),
    searchState: computed(() => ({ query: "", loading: false, error: "", results: [] })),
    pinsDismissed: computed(() => true),
    pins: computed(() => []),
    pinsLoading: computed(() => false),
    pinsError: computed(() => ""),
    messageReveal: computed(() => null),
    domainRegistryStore: shallowRef({}),
    fmtGroupHeadTime: (timeMs: number, showDate: boolean) => `${showDate ? "10-09 " : ""}${timeMs}`,
    isMentioned: () => false,
    isMessageSelected: () => false,
    toggleMessageSelection: () => undefined,
    formatReplyMiniText: () => "",
    dismissLinkPreview: () => undefined,
  };
  return proxyRefs(model) as unknown as ChatCenterModel;
}

/**
 * 挂载聊天中央区。
 *
 * @param messages - 消息列表（时间正序）。
 * @returns 测试用 wrapper。
 */
function mountCenter(messages: readonly ChatMessage[]) {
  return mount(ChatCenter, {
    props: {
      model: makeModel(messages),
      showJumpToBottom: false,
      onJumpToBottom: () => undefined,
      onSignalScroll: () => undefined,
      registerSignalPane: () => undefined,
      onOpenChannelSettingsMenu: () => undefined,
      onMessageContextMenu: () => undefined,
      onMoreClick: () => undefined,
      onReferenceContextMenu: () => undefined,
      onJumpReference: () => undefined,
      onInstallHint: () => undefined,
      channels: [],
      membersRailOpen: false,
      onToggleMembersRail: () => undefined,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } })],
      // vitest 未启用 TDesign 自动导入解析器：桩掉图标等外部组件，只断言消息行标记。
      stubs: { AppIcon: true, SignalStrip: true },
    },
  });
}

describe("ChatCenter 消息行 domain 色条可见性", () => {
  it("同发送者半天内连发：仅组首渲染色条，组内后续消息隐藏色条但保留槽位列宽", () => {
    const base = Date.now();
    const wrapper = mountCenter([
      makeMessage("m-1", base),
      makeMessage("m-2", base + 30 * 1000),
      makeMessage("m-3", base + 60 * 1000),
    ]);

    expect(wrapper.findAll(".cp-msg").map((row) => row.attributes("data-group-start"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(wrapper.findAll(".cp-msg__strip").map((strip) => strip.attributes("data-visible"))).toEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("单条消息（无上一条）视为组首：色条可见", () => {
    const wrapper = mountCenter([makeMessage("m-1", Date.now())]);

    expect(wrapper.findAll(".cp-msg__strip").map((strip) => strip.attributes("data-visible"))).toEqual(["true"]);
  });

  it("超出半天窗口或发送者变化：新组首色条恢复可见", () => {
    const base = Date.now();
    const wrapper = mountCenter([
      makeMessage("m-1", base),
      makeMessage("m-2", base + 30 * 1000),
      { ...makeMessage("m-3", base + 31 * 1000), from: { id: "u-2", name: "Relay" } } as ChatMessage,
      makeMessage("m-4", base + 13 * 60 * 60 * 1000),
    ]);

    expect(wrapper.findAll(".cp-msg").map((row) => row.attributes("data-group-start"))).toEqual([
      "true",
      "false",
      "true",
      "true",
    ]);
    expect(wrapper.findAll(".cp-msg__strip").map((strip) => strip.attributes("data-visible"))).toEqual([
      "true",
      "false",
      "true",
      "true",
    ]);
  });
});
