/**
 * @fileoverview wsManager.test.ts
 * @description chat/room-session｜application：会话 WS 连接句柄管理器行为测试。
 */
import { describe, expect, it, vi } from "vitest";
import { createSessionWsManager } from "./wsManager";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";

type RecordedClient = {
  close: ReturnType<typeof vi.fn>;
  reauth: ReturnType<typeof vi.fn>;
};

function makeEventsPort() {
  const connects: Array<{ socket: string; token: string }> = [];
  const clients: RecordedClient[] = [];
  const port = {
    connect(socket: string, token: string, _onEvent: (evt: ChatEventEnvelope) => void): RecordedClient {
      connects.push({ socket, token });
      const client: RecordedClient = { close: vi.fn(), reauth: vi.fn() };
      clients.push(client);
      return client;
    },
  };
  return { port, connects, clients };
}

const onEvent = (): void => undefined;

describe("createSessionWsManager", () => {
  it("同一 socket 首次连接为新建，重复调用复用既有句柄", () => {
    const { port, connects } = makeEventsPort();
    const manager = createSessionWsManager(port as never);

    const first = manager.ensureConnected("sk-1", "t1", onEvent);
    expect(first).toEqual({ reused: false });
    expect(connects).toEqual([{ socket: "sk-1", token: "t1" }]);

    const second = manager.ensureConnected("sk-1", "t1", onEvent);
    expect(second).toEqual({ reused: true });
    expect(connects).toHaveLength(1);
  });

  it("不同 socket 会关闭旧句柄并新建连接", () => {
    const { port, connects, clients } = makeEventsPort();
    const manager = createSessionWsManager(port as never);

    manager.ensureConnected("sk-1", "t1", onEvent);
    manager.ensureConnected("sk-2", "t1", onEvent);

    expect(clients[0]?.close).toHaveBeenCalledTimes(1);
    expect(connects.map((entry) => entry.socket)).toEqual(["sk-1", "sk-2"]);
  });

  it("forceReconnect 关闭旧句柄并用给定 token 新建连接", () => {
    const { port, connects, clients } = makeEventsPort();
    const manager = createSessionWsManager(port as never);

    manager.ensureConnected("sk-1", "stale-token", onEvent);
    manager.forceReconnect("sk-1", "fresh-token", onEvent);

    expect(clients[0]?.close).toHaveBeenCalledTimes(1);
    expect(connects).toEqual([
      { socket: "sk-1", token: "stale-token" },
      { socket: "sk-1", token: "fresh-token" },
    ]);
    expect(manager.isConnectedFor("sk-1")).toBe(true);
  });

  it("空 socket key 不触发任何连接", () => {
    const { port, connects } = makeEventsPort();
    const manager = createSessionWsManager(port as never);

    const result = manager.ensureConnected("", "t1", onEvent);
    manager.forceReconnect("", "t1", onEvent);

    expect(result).toEqual({ reused: true });
    expect(connects).toHaveLength(0);
  });

  it("reauthIfConnectedFor 仅对当前 socket 生效", () => {
    const { port, clients } = makeEventsPort();
    const manager = createSessionWsManager(port as never);

    manager.ensureConnected("sk-1", "t1", onEvent);
    manager.reauthIfConnectedFor("sk-other", "t2");
    expect(clients[0]?.reauth).not.toHaveBeenCalled();

    manager.reauthIfConnectedFor("sk-1", "t2");
    expect(clients[0]?.reauth).toHaveBeenCalledWith("t2");
  });
});
