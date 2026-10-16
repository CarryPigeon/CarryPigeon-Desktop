/**
 * @fileoverview PinnedChannelsDialog.test.ts
 * @description 测试置顶频道编辑器：区块渲染、置顶/取消置顶、排序、草稿保存与陈旧 id 清理。
 */

import { describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import { mount, type DOMWrapper, type VueWrapper } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";
import PinnedChannelsDialog from "./PinnedChannelsDialog.vue";

const i18n = createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } });

/** t-dialog 轻量替身：渲染默认插槽，避免测试依赖 TDesign 运行时。 */
const DialogStub = defineComponent({
  name: "TDialog",
  props: { visible: { type: Boolean, default: false } },
  template: `<div class="cp-dialog-stub" :data-visible="String(visible)"><slot /></div>`,
});

function summary(id: string, name: string): ChannelSummary {
  return { id, name, unread: 0, brief: `${name} brief`, joined: true, joinRequested: false };
}

type DialogProps = {
  visible: boolean;
  serverName?: string;
  channels: readonly ChannelSummary[];
  pinnedIds: readonly string[];
  saving?: boolean;
};

function mountDialog(overrides: Partial<DialogProps> = {}): VueWrapper {
  return mount(PinnedChannelsDialog, {
    props: {
      visible: true,
      serverName: "Server A",
      channels: [summary("c1", "Alpha"), summary("c2", "Beta"), summary("c3", "Gamma")],
      pinnedIds: ["c2"],
      ...overrides,
    },
    global: {
      plugins: [i18n],
      stubs: { "t-dialog": DialogStub, "t-input": true },
    },
  });
}

/** 已置顶区的频道 ID 顺序。 */
function pinnedIds(wrapper: VueWrapper): string[] {
  return wrapper
    .findAll('.cp-pinEditor__row[data-region="pinned"]')
    .map((row) => row.attributes("data-channel-id") ?? "");
}

/** 候选区的频道 ID 顺序。 */
function candidateIds(wrapper: VueWrapper): string[] {
  return wrapper
    .findAll('.cp-pinEditor__row[data-region="candidate"]')
    .map((row) => row.attributes("data-channel-id") ?? "");
}

function findRow(wrapper: VueWrapper, text: string): DOMWrapper<Element> {
  const row = wrapper.findAll(".cp-pinEditor__row").find((item) => item.text().includes(text));
  if (!row) throw new Error(`row not found: ${text}`);
  return row;
}

/** 按文案或无障碍标签命中按钮（图标按钮已改为自绘 SVG，不再有文本内容）。 */
function clickButton(row: DOMWrapper<Element>, label: string): void {
  const button = row
    .findAll("button")
    .find(
      (item) =>
        item.text().trim() === label ||
        item.attributes("aria-label") === label ||
        item.attributes("title") === label,
    );
  if (!button) throw new Error(`button not found: ${label}`);
  void button.trigger("click");
}

describe("PinnedChannelsDialog", () => {
  it("splits pinned and candidate channels", () => {
    const wrapper = mountDialog();

    expect(pinnedIds(wrapper)).toEqual(["c2"]);
    expect(candidateIds(wrapper)).toEqual(["c1", "c3"]);
    expect(wrapper.text()).toContain("Server A");
  });

  it("pins a candidate at the end of the draft order", async () => {
    const wrapper = mountDialog();

    clickButton(findRow(wrapper, "Alpha"), "置顶频道");
    await wrapper.vm.$nextTick();

    expect(pinnedIds(wrapper)).toEqual(["c2", "c1"]);
    expect(candidateIds(wrapper)).toEqual(["c3"]);
  });

  it("reorders the draft with the arrow buttons", async () => {
    const wrapper = mountDialog({ pinnedIds: ["c2", "c1"] });

    clickButton(findRow(wrapper, "Alpha"), zh_cn.channel_pins_editor_move_up);
    await wrapper.vm.$nextTick();

    expect(pinnedIds(wrapper)).toEqual(["c1", "c2"]);
  });

  it("unpins a channel from the draft", async () => {
    const wrapper = mountDialog({ pinnedIds: ["c1", "c2"] });

    clickButton(findRow(wrapper, "Beta"), "取消置顶");
    await wrapper.vm.$nextTick();

    expect(pinnedIds(wrapper)).toEqual(["c1"]);
    expect(candidateIds(wrapper)).toEqual(["c2", "c3"]);
  });

  it("keeps pinned ids missing from the directory removable", async () => {
    const wrapper = mountDialog({ channels: [], pinnedIds: ["ghost"] });

    expect(pinnedIds(wrapper)).toEqual(["ghost"]);
    expect(wrapper.text()).toContain("ghost");

    clickButton(findRow(wrapper, "ghost"), "取消置顶");
    await wrapper.vm.$nextTick();

    expect(pinnedIds(wrapper)).toEqual([]);
  });

  it("emits the whole draft order on save", async () => {
    const wrapper = mountDialog({ pinnedIds: ["c2", "c1"] });

    clickButton(findRow(wrapper, "Alpha"), zh_cn.channel_pins_editor_move_up);
    await wrapper.vm.$nextTick();

    const saveButton = wrapper.findAll("button").find((button) => button.text().trim() === "保存");
    await saveButton?.trigger("click");

    expect(wrapper.emitted("confirm")?.[0]).toEqual([["c1", "c2"]]);
  });
});
