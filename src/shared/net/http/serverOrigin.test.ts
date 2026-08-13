/**
 * @fileoverview serverOrigin 单元测试
 */

import { describe, expect, it } from "vitest";
import { resolveServerUrl, toHttpOrigin } from "./serverOrigin";

describe("toHttpOrigin", () => {
  it("keeps explicit http and https origins", () => {
    expect(toHttpOrigin("http://127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(toHttpOrigin("https://chat.example.com:8443/api")).toBe("https://chat.example.com:8443");
  });

  it("maps loopback HTTP default ports to http for CarryPigeon-Server", () => {
    expect(toHttpOrigin("127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(toHttpOrigin("localhost:8080")).toBe("http://localhost:8080");
    expect(toHttpOrigin("localhost")).toBe("http://localhost");
    expect(toHttpOrigin("127.0.0.1:80")).toBe("http://127.0.0.1");
  });

  it("keeps TLS as the default for scheme-less internet hosts", () => {
    expect(toHttpOrigin("example.com")).toBe("https://example.com");
    expect(toHttpOrigin("example.com:8443")).toBe("https://example.com:8443");
    expect(toHttpOrigin("127.0.0.1:8443")).toBe("https://127.0.0.1:8443");
  });

  it("maps legacy transport schemes", () => {
    expect(toHttpOrigin("tcp://127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(toHttpOrigin("tls://127.0.0.1:9443")).toBe("https://127.0.0.1:9443");
    expect(toHttpOrigin("wss://example.com/api/ws")).toBe("https://example.com");
    expect(toHttpOrigin("mock://handshake")).toBe("http://mock.local");
  });
});

describe("resolveServerUrl", () => {
  it("joins relative paths onto the current server origin", () => {
    expect(resolveServerUrl("http://127.0.0.1:8080", "api/files/download/server_avatar")).toBe(
      "http://127.0.0.1:8080/api/files/download/server_avatar",
    );
    expect(resolveServerUrl("127.0.0.1:8080", "/avatars/u/1.png")).toBe("http://127.0.0.1:8080/avatars/u/1.png");
  });
});
