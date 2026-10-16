/**
 * @fileoverview AI 总结后端偏好纯逻辑单测。
 * @description 覆盖：持久化值解析容错、三档后端 → 请求计划映射、回退判定规则。
 */

import { describe, expect, it } from "vitest";
import {
  parseSummarizeBackend,
  resolveBackendPlan,
  shouldFallbackToServer,
  SUMMARIZE_BACKEND_STORAGE_KEY,
  SUMMARIZE_BACKENDS,
} from "./summarizeBackend";

describe("parseSummarizeBackend", () => {
  it("接受三档合法值（大小写/空白容错）", () => {
    expect(parseSummarizeBackend("auto")).toBe("auto");
    expect(parseSummarizeBackend(" CLIENT ")).toBe("client");
    expect(parseSummarizeBackend("server")).toBe("server");
  });

  it("非法/缺失值回退 auto（历史默认行为）", () => {
    expect(parseSummarizeBackend(undefined)).toBe("auto");
    expect(parseSummarizeBackend(null)).toBe("auto");
    expect(parseSummarizeBackend(42)).toBe("auto");
    expect(parseSummarizeBackend("hosted")).toBe("auto");
    expect(parseSummarizeBackend("")).toBe("auto");
  });

  it("暴露稳定的存储 key 与档位清单", () => {
    expect(SUMMARIZE_BACKEND_STORAGE_KEY).toBe("ai_summary.backend");
    expect([...SUMMARIZE_BACKENDS]).toEqual(["auto", "client", "server"]);
  });
});

describe("resolveBackendPlan", () => {
  it("有客户端 AI 时按档位决定使用与回退", () => {
    expect(resolveBackendPlan("auto", true)).toEqual({ useClient: true, allowServerFallback: true });
    expect(resolveBackendPlan("client", true)).toEqual({ useClient: true, allowServerFallback: false });
    expect(resolveBackendPlan("server", true)).toEqual({ useClient: false, allowServerFallback: true });
  });

  it("无客户端 AI（旧宿主/无权限）时只能走服务端", () => {
    expect(resolveBackendPlan("auto", false)).toEqual({ useClient: false, allowServerFallback: true });
    expect(resolveBackendPlan("client", false)).toEqual({ useClient: false, allowServerFallback: true });
    expect(resolveBackendPlan("server", false)).toEqual({ useClient: false, allowServerFallback: true });
  });
});

describe("shouldFallbackToServer", () => {
  it("仅 not-configured 且计划允许回退时回退", () => {
    expect(shouldFallbackToServer("not-configured", { allowServerFallback: true })).toBe(true);
    expect(shouldFallbackToServer("not-configured", { allowServerFallback: false })).toBe(false);
    expect(shouldFallbackToServer("api-key-missing", { allowServerFallback: true })).toBe(false);
    expect(shouldFallbackToServer("request-failed", { allowServerFallback: true })).toBe(false);
    expect(shouldFallbackToServer("incomplete-config", { allowServerFallback: true })).toBe(false);
  });
});
