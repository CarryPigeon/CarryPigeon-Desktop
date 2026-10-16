/**
 * @fileoverview plugins｜运行时：插件设置项注册表单测。
 * @description 覆盖：注册/列表排序、同 id 替换与取消函数语义、非法输入拒绝、单插件上限、反注册与清空。
 */

import { describe, expect, it } from "vitest";
import type { Component } from "vue";
import { createPluginSettingsRegistry, PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN } from "./pluginSettingsRegistry";

/** 占位组件（只用于标识）。 */
function componentOf(name: string): Component {
  return { name } as unknown as Component;
}

describe("createPluginSettingsRegistry", () => {
  it("按 order → pluginId → 注册序排序，并携带来源信息", () => {
    const registry = createPluginSettingsRegistry("srv");
    registry.register("b-plugin", { id: "x", title: "B", component: componentOf("B"), order: 5 });
    registry.register("a-plugin", { id: "y", title: "A", component: componentOf("A"), order: 1 });
    registry.register("a-plugin", { id: "z", title: "A2", component: componentOf("A2"), order: 1 });
    // 缺省 order = 0，排在最前。
    registry.register("c-plugin", { id: "w", title: "C", component: componentOf("C") });

    expect(registry.list().map((item) => `${item.pluginId}:${item.id}`)).toEqual([
      "c-plugin:w",
      "a-plugin:y",
      "a-plugin:z",
      "b-plugin:x",
    ]);
    expect(registry.list()[0]?.serverSocket).toBe("srv");
  });

  it("规范化关键词、描述与排序值", () => {
    const registry = createPluginSettingsRegistry();
    registry.register("p", {
      id: " a ",
      title: "  标题  ",
      description: "  说明  ",
      keywords: [" 后端 ", "后端", "", "backend"],
      order: Number.NaN,
      component: componentOf("A"),
    });

    const item = registry.list()[0]!;
    expect(item.id).toBe("a");
    expect(item.title).toBe("标题");
    expect(item.description).toBe("说明");
    expect(item.keywords).toEqual(["后端", "backend"]);
    expect(item.order).toBe(0);
    expect(item.serverSocket).toBe("");
  });

  it("同 id 重复注册视为替换，旧取消函数不会误删新项", () => {
    const registry = createPluginSettingsRegistry();
    const cancelFirst = registry.register("p", { id: "k", title: "旧", component: componentOf("Old") });
    registry.register("p", { id: "k", title: "新", component: componentOf("New") });

    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.title).toBe("新");

    cancelFirst();
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.title).toBe("新");
  });

  it("取消函数幂等", () => {
    const registry = createPluginSettingsRegistry();
    const cancel = registry.register("p", { id: "k", title: "T", component: componentOf("A") });
    cancel();
    cancel();
    expect(registry.list()).toEqual([]);
  });

  it("非法 id / 空标题 / 缺组件被拒绝并返回 no-op", () => {
    const registry = createPluginSettingsRegistry();
    expect(registry.register("p", { id: "bad id", title: "T", component: componentOf("A") })).toBeTypeOf("function");
    registry.register("p", { id: "ok", title: "   ", component: componentOf("A") });
    registry.register("p", { id: "ok", title: "T", component: undefined as unknown as Component });
    expect(registry.list()).toEqual([]);
  });

  it(`单插件超过 ${PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN} 项时忽略超出部分`, () => {
    const registry = createPluginSettingsRegistry();
    for (let index = 0; index <= PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN; index += 1) {
      registry.register("p", { id: `item-${index}`, title: `T${index}`, component: componentOf("A") });
    }
    expect(registry.list()).toHaveLength(PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN);
  });

  it("unregister 清理指定插件的全部设置项，clear 清空注册表", () => {
    const registry = createPluginSettingsRegistry();
    registry.register("a", { id: "1", title: "A1", component: componentOf("A") });
    registry.register("b", { id: "1", title: "B1", component: componentOf("B") });
    registry.unregister("a");
    expect(registry.list().map((item) => item.pluginId)).toEqual(["b"]);
    registry.clear();
    expect(registry.list()).toEqual([]);
  });
});
