/**
 * @fileoverview 浏览器 Vite 预览 API 代理判定测试。
 */

import { describe, expect, it } from "vitest";
import {
  getDevProxiedApiBaseUrl,
  getDevProxiedWsUrl,
  shouldUseDevApiProxy,
} from "./devApiProxy";

const PAGE = "http://127.0.0.1:1420";

describe("shouldUseDevApiProxy", () => {
  it("rewrites loopback CarryPigeon-Server from the Vite preview origin", () => {
    expect(
      shouldUseDevApiProxy("http://127.0.0.1:8080", {
        pageOrigin: PAGE,
        isTauri: false,
        isDev: true,
      }),
    ).toBe(true);
    expect(
      shouldUseDevApiProxy("127.0.0.1:8080", {
        pageOrigin: PAGE,
        isTauri: false,
        isDev: true,
      }),
    ).toBe(true);
    expect(
      shouldUseDevApiProxy("localhost:8080", {
        pageOrigin: "http://localhost:1420",
        isTauri: false,
        isDev: true,
      }),
    ).toBe(true);
  });

  it("does not rewrite Tauri, production, remote hosts, or same-origin sockets", () => {
    expect(
      shouldUseDevApiProxy("http://127.0.0.1:8080", {
        pageOrigin: PAGE,
        isTauri: true,
        isDev: true,
      }),
    ).toBe(false);
    expect(
      shouldUseDevApiProxy("http://127.0.0.1:8080", {
        pageOrigin: PAGE,
        isTauri: false,
        isDev: false,
      }),
    ).toBe(false);
    expect(
      shouldUseDevApiProxy("https://chat.example.com", {
        pageOrigin: PAGE,
        isTauri: false,
        isDev: true,
      }),
    ).toBe(false);
    expect(
      shouldUseDevApiProxy("http://127.0.0.1:1420", {
        pageOrigin: PAGE,
        isTauri: false,
        isDev: true,
      }),
    ).toBe(false);
  });
});

describe("dev proxied urls", () => {
  it("builds same-origin HTTP and WS entries", () => {
    expect(getDevProxiedApiBaseUrl(PAGE)).toBe("http://127.0.0.1:1420/api");
    expect(getDevProxiedWsUrl(PAGE)).toBe("ws://127.0.0.1:1420/api/ws");
    expect(getDevProxiedWsUrl("https://localhost:1420")).toBe("wss://localhost:1420/api/ws");
  });
});
