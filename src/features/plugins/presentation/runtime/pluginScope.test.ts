import { describe, it, expect, vi } from "vitest";

import {
  createPluginScope,
  runInPluginScope,
  getCurrentPluginScope,
} from "@/features/plugins/presentation/runtime/pluginScope";

describe("pluginScope", () => {
  it("dispose 顺序：子 scope 先于父 scope", async () => {
    const order: string[] = [];
    const parent = createPluginScope("parent");
    parent.onDispose(() => order.push("parent"));
    const child = parent.createChildScope("child");
    child.onDispose(() => order.push("child"));
    const grandChild = child.createChildScope("grandChild");
    grandChild.onDispose(() => order.push("grandChild"));

    await parent.dispose();
    expect(order).toEqual(["grandChild", "child", "parent"]);
  });

  it("dispose 幂等：重复调用无副作用", async () => {
    const cb = vi.fn();
    const scope = createPluginScope("root");
    scope.onDispose(cb);

    await scope.dispose();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(scope.disposed).toBe(true);

    // 第二次 dispose 不应再次触发回调
    await scope.dispose();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("子树级联：父 dispose 后子 scope 一并销毁且 disposed 为 true", async () => {
    const parent = createPluginScope("parent");
    const childA = parent.createChildScope("child-a");
    const childB = parent.createChildScope("child-b");
    const cbA = vi.fn();
    const cbB = vi.fn();
    childA.onDispose(cbA);
    childB.onDispose(cbB);

    await parent.dispose();
    expect(parent.disposed).toBe(true);
    expect(childA.disposed).toBe(true);
    expect(childB.disposed).toBe(true);
    expect(cbA).toHaveBeenCalledTimes(1);
    expect(cbB).toHaveBeenCalledTimes(1);
  });

  it("回调抛错不阻断：单个回调异常仅告警，其余回调继续执行", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const okBefore = vi.fn();
    const okAfter = vi.fn();
    const boom = () => {
      throw new Error("callback boom");
    };
    const scope = createPluginScope("err-scope");
    scope.onDispose(okBefore);
    scope.onDispose(boom);
    scope.onDispose(okAfter);

    await scope.dispose();
    // LIFO：okAfter（后注册）先执行，随后抛错回调，最后 okBefore
    expect(okAfter).toHaveBeenCalled();
    expect(okBefore).toHaveBeenCalled();
    // 告警日志为英文且包含 scope id
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(msg).toContain("err-scope");
    warnSpy.mockRestore();
  });

  it("回调按后注册先执行（LIFO）", async () => {
    const order: string[] = [];
    const scope = createPluginScope("lifo");
    scope.onDispose(() => order.push("first"));
    scope.onDispose(() => order.push("second"));
    scope.onDispose(() => order.push("third"));

    await scope.dispose();
    expect(order).toEqual(["third", "second", "first"]);
  });

  it("onDispose 撤销注册：被撤销的回调不再触发", async () => {
    const cb = vi.fn();
    const scope = createPluginScope("revoke");
    const off = scope.onDispose(cb);
    off();
    // 重复撤销应为 no-op
    off();

    await scope.dispose();
    expect(cb).not.toHaveBeenCalled();
  });

  it("parent 关系正确维护", () => {
    const parent = createPluginScope("p");
    const child = parent.createChildScope("c");
    expect(child.parent).toBe(parent);
    expect(parent.parent).toBeUndefined();
    expect(child.id).toBe("c");
  });

  it("runInPluginScope：执行期间可获取当前 scope，结束后恢复", () => {
    const outer = createPluginScope("outer");
    const inner = createPluginScope("inner");
    expect(getCurrentPluginScope()).toBeUndefined();

    const seen: Array<string | undefined> = [];
    runInPluginScope(outer, () => {
      seen.push(getCurrentPluginScope()?.id);
      runInPluginScope(inner, () => {
        seen.push(getCurrentPluginScope()?.id);
      });
      // 内层结束后恢复为外层
      seen.push(getCurrentPluginScope()?.id);
    });
    seen.push(getCurrentPluginScope()?.id);

    expect(seen).toEqual(["outer", "inner", "outer", undefined]);
  });

  it("runInPluginScope：fn 抛错时仍恢复绑定并透传异常", () => {
    const scope = createPluginScope("throw");
    expect(() =>
      runInPluginScope(scope, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(getCurrentPluginScope()).toBeUndefined();
  });
});
