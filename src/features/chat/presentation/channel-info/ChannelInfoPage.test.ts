/**
 * @fileoverview ChannelInfoPage.test.ts
 * @description chat｜页面：频道信息页只保留统一返回按钮，不再渲染「返回聊天」入口。
 */

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";

const goBack = vi.fn();

vi.mock("@/features/chat/presentation/channel-info/useChannelInfoPage", async () => {
  const { ref, computed } = await import("vue");
  return {
    useChannelInfoPage: () => ({
      channelId: ref("c1"),
      channelName: ref("Alpha"),
      channelBrief: ref("brief"),
      channelAnnouncement: ref(""),
      membershipStatus: ref("joined"),
      isEditing: ref(false),
      isEditingAnnouncement: ref(false),
      isRequestingJoin: ref(false),
      isSavingMeta: ref(false),
      isSavingAnnouncement: ref(false),
      actionError: ref(""),
      draftChannelName: ref(""),
      draftChannelBrief: ref(""),
      draftChannelAnnouncement: ref(""),
      hasChannel: computed(() => true),
      isJoined: computed(() => true),
      joinRequested: ref(false),
      canRequestJoin: computed(() => false),
      mayEditChannelMeta: computed(() => false),
      beginEdit: vi.fn(),
      cancelEdit: vi.fn(),
      saveEdit: vi.fn(),
      changeAnnouncement: vi.fn(),
      cancelAnnouncementEdit: vi.fn(),
      saveAnnouncement: vi.fn(),
      handleJoin: vi.fn(),
      openInPatchbay: vi.fn(),
      goBack,
    }),
  };
});

const i18n = createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } });

/** 挂载频道信息页。 */
async function mountPage() {
  const { default: ChannelInfoPage } = await import("./ChannelInfoPage.vue");
  return mount(ChannelInfoPage, {
    global: { plugins: [i18n], stubs: { "t-input": true, "t-textarea": true } },
  });
}

describe("ChannelInfoPage", () => {
  it("头部只有一个统一返回控件，且调用了 goBack", async () => {
    const wrapper = await mountPage();

    const backButtons = wrapper.findAll(".cp-back-btn");
    expect(backButtons).toHaveLength(1);
    expect(backButtons[0]!.attributes("data-testid")).toBe("channel-info-back");
    expect(backButtons[0]!.text()).toBe(zh_cn.back);

    await backButtons[0]!.trigger("click");
    expect(goBack).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("不再渲染「返回聊天」按钮", async () => {
    const wrapper = await mountPage();

    expect(wrapper.text()).not.toContain("返回聊天");
    expect(wrapper.find(".cp-info__headRight").exists()).toBe(false);
    wrapper.unmount();
  });
});
