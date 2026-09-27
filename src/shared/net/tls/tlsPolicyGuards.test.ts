/**
 * @fileoverview tlsPolicyGuards 单元测试。
 */
import { describe, expect, it } from "vitest";
import { shouldRejectBearerAuthOverInsecureTls, shouldUseTauriHttpTransport } from "./tlsPolicyGuards";

describe("shouldRejectBearerAuthOverInsecureTls", () => {
  it("仅在 release + insecure + 有 Bearer 时拒绝", () => {
    expect(
      shouldRejectBearerAuthOverInsecureTls({ tlsPolicy: "insecure", hasBearerToken: true, isProduction: true }),
    ).toBe(true);
    expect(
      shouldRejectBearerAuthOverInsecureTls({ tlsPolicy: "insecure", hasBearerToken: true, isProduction: false }),
    ).toBe(false);
    expect(
      shouldRejectBearerAuthOverInsecureTls({ tlsPolicy: "insecure", hasBearerToken: false, isProduction: true }),
    ).toBe(false);
    expect(
      shouldRejectBearerAuthOverInsecureTls({ tlsPolicy: "strict", hasBearerToken: true, isProduction: true }),
    ).toBe(false);
  });
});

describe("shouldUseTauriHttpTransport", () => {
  it("Tauri 运行时内对所有 http(s) 请求走 Rust 通道（绕过 WebView CORS）", () => {
    expect(shouldUseTauriHttpTransport({ url: "http://127.0.0.1:8080/api/auth/login", isTauriRuntime: true })).toBe(true);
    expect(shouldUseTauriHttpTransport({ url: "https://example.com/api/server", isTauriRuntime: true })).toBe(true);
  });

  it("浏览器预览（无 Tauri bridge）回退 fetch", () => {
    expect(shouldUseTauriHttpTransport({ url: "http://127.0.0.1:8080/api/server", isTauriRuntime: false })).toBe(false);
  });

  it("非法 URL 返回 false", () => {
    expect(shouldUseTauriHttpTransport({ url: "not a url", isTauriRuntime: true })).toBe(false);
  });
});
