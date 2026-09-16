/**
 * @fileoverview pluginScopeRegistry 单元测试。
 * @description
 * 覆盖：服务器父 scope 复用、插件子 scope 创建/复用、单实例销毁、
 * 按插件销毁（跨版本）、服务器树级联销毁与全局销毁。
 */

import { describe, expect, it } from "vitest";
import {
  clearPluginScopeRegistry,
  disposeAllServerScopeTrees,
  disposePluginScope,
  disposePluginScopesForPlugin,
  disposeServerScopeTree,
  getOrCreatePluginScope,
  getOrCreateServerScope,
  getPluginScope,
  getServerScope,
} from "./pluginScopeRegistry";

describe("pluginScopeRegistry", () => {
  it("同 serverId 复用同一父 scope", () => {
    const a = getOrCreateServerScope("srv-a");
    const b = getOrCreateServerScope("srv-a");
    expect(b).toBe(a);
    expect(getServerScope("srv-a")).toBe(a);
    expect(getServerScope("srv-b")).toBeNull();
  });

  it("同 key 插件子 scope 幂等复用，不同版本互不相同", () => {
    const s1 = getOrCreatePluginScope({ serverId: "srv-a", pluginId: "p1", version: "1.0.0" });
    const s2 = getOrCreatePluginScope({ serverId: "srv-a", pluginId: "p1", version: "1.0.0" });
    const s3 = getOrCreatePluginScope({ serverId: "srv-a", pluginId: "p1", version: "2.0.0" });
    expect(s2).toBe(s1);
    expect(s3).not.toBe(s1);
    expect(getPluginScope({ serverId: "srv-a", pluginId: "p1", version: "1.0.0" })).toBe(s1);
    // 未带 version 的兜底查询可命中任意版本
    expect(getPluginScope({ serverId: "srv-a", pluginId: "p1", version: "" })).toBeTruthy();
    expect(getPluginScope({ serverId: "srv-a", pluginId: "p9", version: "1.0.0" })).toBeNull();
    expect(s1.parent).toBe(getServerScope("srv-a"));
  });

  it("disposePluginScope 销毁单个实例并可重建", async () => {
    const s1 = getOrCreatePluginScope({ serverId: "srv-b", pluginId: "p1", version: "1.0.0" });
    const disposed: string[] = [];
    s1.onDispose(() => disposed.push("cleanup"));
    await disposePluginScope({ serverId: "srv-b", pluginId: "p1", version: "1.0.0" });
    expect(s1.disposed).toBe(true);
    expect(disposed).toEqual(["cleanup"]);
    // 幂等：重复销毁无副作用
    await disposePluginScope({ serverId: "srv-b", pluginId: "p1", version: "1.0.0" });
    expect(disposed).toEqual(["cleanup"]);
    // 重建后得到新 scope
    const s2 = getOrCreatePluginScope({ serverId: "srv-b", pluginId: "p1", version: "1.0.0" });
    expect(s2).not.toBe(s1);
    expect(s2.disposed).toBe(false);
  });

  it("disposePluginScopesForPlugin 销毁该插件全部版本 scope", async () => {
    getOrCreatePluginScope({ serverId: "srv-c", pluginId: "p1", version: "1.0.0" });
    getOrCreatePluginScope({ serverId: "srv-c", pluginId: "p1", version: "2.0.0" });
    const other = getOrCreatePluginScope({ serverId: "srv-c", pluginId: "p2", version: "1.0.0" });
    await disposePluginScopesForPlugin("srv-c", "p1");
    expect(getPluginScope({ serverId: "srv-c", pluginId: "p1", version: "1.0.0" })).toBeNull();
    expect(getPluginScope({ serverId: "srv-c", pluginId: "p1", version: "2.0.0" })).toBeNull();
    expect(other.disposed).toBe(false);
  });

  it("disposeServerScopeTree 级联销毁全部子 scope", async () => {
    const parent = getOrCreateServerScope("srv-d");
    const c1 = getOrCreatePluginScope({ serverId: "srv-d", pluginId: "p1", version: "1.0.0" });
    const c2 = getOrCreatePluginScope({ serverId: "srv-d", pluginId: "p2", version: "1.0.0" });
    const order: string[] = [];
    parent.onDispose(() => order.push("parent"));
    c1.onDispose(() => order.push("c1"));
    c2.onDispose(() => order.push("c2"));
    await disposeServerScopeTree("srv-d");
    expect(parent.disposed).toBe(true);
    expect(c1.disposed).toBe(true);
    expect(c2.disposed).toBe(true);
    // 子 scope 先于父 scope 销毁
    expect(order.indexOf("parent")).toBeGreaterThan(order.indexOf("c1"));
    expect(order.indexOf("parent")).toBeGreaterThan(order.indexOf("c2"));
    expect(getServerScope("srv-d")).toBeNull();
  });

  it("disposeAllServerScopeTrees 清空全部服务器树", async () => {
    const a = getOrCreateServerScope("srv-e");
    const b = getOrCreateServerScope("srv-f");
    await disposeAllServerScopeTrees();
    expect(a.disposed).toBe(true);
    expect(b.disposed).toBe(true);
    expect(getServerScope("srv-e")).toBeNull();
    expect(getServerScope("srv-f")).toBeNull();
  });

  it("父 scope 已销毁后重建子 scope 不挂到死节点", () => {
    const parent = getOrCreateServerScope("srv-g");
    const stale = getOrCreatePluginScope({ serverId: "srv-g", pluginId: "p1", version: "1.0.0" });
    void parent.dispose();
    expect(stale.disposed).toBe(true);
    const revived = getOrCreatePluginScope({ serverId: "srv-g", pluginId: "p1", version: "1.0.0" });
    expect(revived.disposed).toBe(false);
    expect(revived.parent?.disposed).toBe(false);
    clearPluginScopeRegistry();
  });
});
