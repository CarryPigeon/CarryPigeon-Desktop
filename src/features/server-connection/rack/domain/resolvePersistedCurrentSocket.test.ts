/**
 * @fileoverview resolvePersistedCurrentSocket 单元测试。
 */

import { describe, expect, it } from "vitest";
import { resolvePersistedCurrentSocket } from "./resolvePersistedCurrentSocket";
import type { ServerRackRecord, StoredServerRacksState } from "./types/serverRackTypes";

function rack(partial: Partial<ServerRackRecord> & Pick<ServerRackRecord, "id" | "serverSocket">): ServerRackRecord {
  return {
    name: partial.name ?? partial.id,
    pinned: Boolean(partial.pinned),
    note: "",
    tlsPolicy: "strict",
    tlsFingerprint: "",
    notifyMode: "notify",
    ...partial,
  };
}

describe("resolvePersistedCurrentSocket", () => {
  it("returns the persisted socket when it still exists in the directory", () => {
    const state: StoredServerRacksState = {
      servers: [rack({ id: "a", serverSocket: "http://127.0.0.1:8080" }), rack({ id: "b", serverSocket: "http://10.0.0.2:8080" })],
      currentServerSocket: "http://10.0.0.2:8080",
    };
    expect(resolvePersistedCurrentSocket(state)).toBe("http://10.0.0.2:8080");
  });

  it("falls back to the pinned rack when persisted socket is missing", () => {
    const state: StoredServerRacksState = {
      servers: [
        rack({ id: "a", serverSocket: "http://127.0.0.1:8080" }),
        rack({ id: "b", serverSocket: "http://10.0.0.2:8080", pinned: true }),
      ],
    };
    expect(resolvePersistedCurrentSocket(state)).toBe("http://10.0.0.2:8080");
  });

  it("falls back to the first rack when persisted socket is stale", () => {
    const state: StoredServerRacksState = {
      servers: [rack({ id: "a", serverSocket: "http://127.0.0.1:8080" })],
      currentServerSocket: "http://stale.example:8080",
    };
    expect(resolvePersistedCurrentSocket(state)).toBe("http://127.0.0.1:8080");
  });

  it("returns empty string when the directory is empty", () => {
    expect(resolvePersistedCurrentSocket({ servers: [] })).toBe("");
  });
});
