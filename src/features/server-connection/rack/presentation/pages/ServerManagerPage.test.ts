/**
 * @fileoverview ServerManagerPage.test.ts
 * @description server-connection/rack｜页面：服务器管理展示层单测。
 *
 * 覆盖：
 * - 页头不再渲染冗余副标题；
 * - 新增区只保留「添加服务器」主操作；
 * - rack 行展示态只保留条件性补充信息（TLS 指纹 / 备注），不再重复渲染 TLS 策略与通知模式；
 * - 展示态 / 编辑态互斥，且行内无补充信息时两个区域都不渲染。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import ServerManagerPage from "./ServerManagerPage.vue";
import { addServer, removeServerById, serverRacks, updateServerRack } from "../store";

const i18n = createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } });

/** t-dialog 轻量替身：把 visible 暴露为可断言的 DOM 属性并渲染默认插槽。 */
const DialogStub = defineComponent({
  name: "TDialog",
  props: { visible: { type: Boolean, default: false } },
  emits: ["confirm", "update:visible"],
  template: `<div class="cp-dialog-stub" :data-visible="String(visible)"><slot /></div>`,
});

let wrapper: VueWrapper | null = null;

async function mountPage(): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/servers", component: { template: "<div />" } }] });
  await router.push("/servers");
  await router.isReady();
  wrapper = mount(ServerManagerPage, {
    global: {
      plugins: [i18n, router],
      stubs: { "t-input": true, "t-select": true, "t-option": true, "t-dialog": DialogStub },
    },
  });
  return { wrapper, router };
}

/** 按可见文案查找操作按钮。 */
function findButton(root: VueWrapper, label: string) {
  return root.findAll("button").find((btn) => btn.text().trim() === label);
}

beforeEach(() => {
  // 清空 rack store，避免用例间相互污染
  for (const rack of [...serverRacks.value]) removeServerById(rack.id);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe("ServerManagerPage 展示层", () => {
  it("不渲染冗余副标题，新增区只保留「添加服务器」入口", async () => {
    addServer("http://127.0.0.1:18081", "Server");
    const { wrapper: page } = await mountPage();

    expect(page.find(".cp-page-header__sub").exists()).toBe(false);
    expect(page.text()).toContain("服务器管理");
    // 新增区只剩主操作，无额外跳转入口
    expect(page.find(".cp-servers__actions").findAll("button")).toHaveLength(1);
  });

  it("rack 行不再重复展示 TLS 策略与通知模式，仅保留指纹/备注", async () => {
    addServer("http://127.0.0.1:18082", "Server");
    const { wrapper: page } = await mountPage();

    // strict + 无备注：展示态没有任何补充信息
    expect(page.find(".cp-rackRow__meta").exists()).toBe(false);
    expect(page.find(".cp-rackRow__edit").exists()).toBe(false);

    // 加上备注后只显示备注，不显示 TLS 策略/通知模式
    const rack = serverRacks.value.find((item) => item.serverSocket === "http://127.0.0.1:18082");
    expect(rack).toBeTruthy();
    updateServerRack(rack!.id, { note: "本机调试用" });
    await page.vm.$nextTick();

    const meta = page.find(".cp-rackRow__meta");
    expect(meta.exists()).toBe(true);
    expect(meta.text()).toContain("本机调试用");
    expect(meta.text()).not.toContain("strict");
    expect(meta.text()).not.toContain("notify");
  });

  it("点击「编辑」进入编辑态，退出后回到展示态", async () => {
    addServer("http://127.0.0.1:18083", "Server");
    const { wrapper: page } = await mountPage();

    expect(page.find(".cp-rackRow__edit").exists()).toBe(false);

    const editButton = findButton(page, "编辑");
    expect(editButton).toBeTruthy();
    await editButton!.trigger("click");

    expect(page.find(".cp-rackRow__edit").exists()).toBe(true);
    expect(page.find(".cp-rackRow__meta").exists()).toBe(false);

    const cancelButton = findButton(page, "取消");
    expect(cancelButton).toBeTruthy();
    await cancelButton!.trigger("click");

    expect(page.find(".cp-rackRow__edit").exists()).toBe(false);
  });

  it("服务器行提供「退出登录」并弹出该服务器维度的确认框", async () => {
    addServer("http://127.0.0.1:18084", "Server");
    const { wrapper: page } = await mountPage();

    const dialog = page.find(".cp-dialog-stub");
    expect(dialog.attributes("data-visible")).toBe("false");

    const logoutButton = findButton(page, "退出登录");
    expect(logoutButton).toBeTruthy();
    await logoutButton!.trigger("click");

    expect(page.find(".cp-dialog-stub").attributes("data-visible")).toBe("true");
    const dialogText = page.find(".cp-dialog-stub").text();
    expect(dialogText).toContain("确定要退出该服务器的登录吗？");
    // 弹窗内展示目标服务器，避免误退其它服务器
    expect(dialogText).toContain("http://127.0.0.1:18084");
  });
});
