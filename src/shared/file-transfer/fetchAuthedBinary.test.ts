/**
 * @fileoverview fetchAuthedBinary 契约测试。
 * @description 验证 302 预签名重定向不会把 Bearer 带到对象存储。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAuthedBinary } from "./fetchAuthedBinary";

describe("fetchAuthedBinary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should follow 302 Location without Authorization", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "http://127.0.0.1:9000/object?X-Amz-Signature=1" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);

    const blob = await fetchAuthedBinary("http://127.0.0.1:8080/api/files/download/shr_x", "tok");
    expect(await blob.text()).toBe("ok");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/api/files/download/shr_x",
      { headers: { Authorization: "Bearer tok" }, redirect: "manual" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:9000/object?X-Amz-Signature=1",
    );
  });

  it("should return 200 body without a second hop", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("direct", { status: 200, headers: { "Content-Type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = await fetchAuthedBinary("http://127.0.0.1:8080/api/files/download/server_avatar", "");
    expect(await blob.text()).toBe("direct");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
