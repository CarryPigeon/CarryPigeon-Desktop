/**
 * @fileoverview GovernancePageShell.test.ts
 * @description chat/room-governance｜组件：治理页骨架使用统一返回控件并透出 back 事件。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import GovernancePageShell from "./GovernancePageShell.vue";

const i18n = createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } });

/** 挂载治理页骨架。 */
function mountShell(props: Record<string, unknown> = {}) {
  return mount(GovernancePageShell, {
    props: { channelName: "Alpha", subtitle: "成员 (3)", isLoading: false, errorMessage: "", ...props },
    global: { plugins: [i18n] },
  });
}

describe("GovernancePageShell", () => {
  it("返回按钮为统一共享控件且文案取 i18n", async () => {
    const wrapper = mountShell();

    const back = wrapper.find(".cp-back-btn");
    expect(back.exists()).toBe(true);
    expect(back.text()).toBe(zh_cn.back);

    await back.trigger("click");
    expect(wrapper.emitted("back")).toHaveLength(1);
    wrapper.unmount();
  });

  it("加载态与错误态优先于默认内容槽", () => {
    const loading = mountShell({ isLoading: true });
    expect(loading.find(".cp-governancePage__state").exists()).toBe(true);
    expect(loading.find(".cp-governancePage__body").exists()).toBe(false);
    loading.unmount();

    const failed = mountShell({ errorMessage: "boom" });
    expect(failed.find(".cp-governancePage__state--error").text()).toBe("boom");
    failed.unmount();
  });
});
