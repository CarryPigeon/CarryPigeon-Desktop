/**
 * @fileoverview wsChatEvents.test.ts
 * @description chat｜数据层：wsChatEvents 连接健康度行为测试。
 * 覆盖：auth 失败关连接、reauth 失败保连接、连续失败触发 lost、恢复触发 restored、pong 判活、
 * ws_url 归一化（明文对齐 + 同主机校验）、reauth 门控。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectChatWs, type WsEventEnvelope } from "./wsChatEvents";

type FakeWsInstance = {
  url: string;
  readyState: number;
  sent: string[];
  open(): void;
  serverPush(payload: unknown): void;
  close(): void;
};

let lastClient: FakeWsInstance | null = null;

class FakeWs {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Array<(evt: unknown) => void>>();

  constructor(public url: string) {
    lastClient = (this as unknown as FakeWsInstance);
  }

  addEventListener(type: string, cb: (evt: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, cb: (evt: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    const idx = list.indexOf(cb);
    if (idx >= 0) list.splice(idx, 1);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit("close", {});
  }

  emit(type: string, evt: unknown): void {
    for (const cb of [...(this.listeners.get(type) ?? [])]) cb(evt);
  }

  /** 模拟握手成功。 */
  open(): void {
    this.readyState = 1;
    this.emit("open", {});
  }

  /** 模拟服务端推帧。 */
  serverPush(payload: unknown): void {
    this.emit("message", { data: JSON.stringify(payload) });
  }
}

function currentClient(): FakeWsInstance {
  if (!lastClient) throw new Error("no websocket created");
  return lastClient;
}

function authOkFrame(): unknown {
  return { type: "auth.ok", id: "req-1", data: { uid: "1000" } };
}

describe("wsChatEvents 连接健康度", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeWs as unknown as typeof WebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("只发送 token 鉴权，重连认证不携带事件游标；reauth 不触发补拉", async () => {
    const onAuthenticated = vi.fn();
    const onEvent = vi.fn();
    const handle = connectChatWs("host-protocol:8080", "token", onEvent, { onAuthenticated });
    const first = currentClient();
    first.open();
    expect(JSON.parse(first.sent[0])).toEqual({ type: "auth", id: expect.any(String), data: { access_token: "token" } });
    const frame = (id: string) => ({ type: "event", id: null, error: null, data: {
      event_id: id, event_type: "message.created", server_time: 1700000000000,
      payload: { channel_id: "2001", message_id: id, event_sequence: 1 },
    } });
    first.serverPush(frame("10"));
    expect(onEvent).not.toHaveBeenCalled();
    first.serverPush(authOkFrame());
    first.serverPush(frame("10"));
    first.close();
    await vi.advanceTimersByTimeAsync(2000);
    const second = currentClient();
    expect(second).not.toBe(first);
    second.open();
    expect(JSON.parse(second.sent[0]).data).toEqual({ access_token: "token" });
    second.serverPush({ type: "auth.ok", id: "req-1", code: 0, data: { uid: "1000" } });
    second.serverPush(frame("9"));
    second.serverPush({ type: "reauth.ok" });
    expect(onAuthenticated.mock.calls).toEqual([[false], [true]]);
    expect(onEvent.mock.calls.map(([frame]) => frame.data.event_id)).toEqual(["10", "9"]);
    handle.close();
  });

  it.each([
    { frame: { type: "auth.err", id: "req-1", code: 11001 }, reason: "unauthorized" },
    { frame: { type: "auth.err", id: "req-1", code: 11003 }, reason: "invalid_access_token" },
    { frame: { type: "auth.err", id: null, code: 19999 }, reason: "api_error_19999" },
  ])("首次 auth.err 会关闭当前连接并回调 onAuthError ($reason)", ({ frame, reason }) => {
    const onAuthError = vi.fn();
    connectChatWs("host-a:8080", "token", () => {}, { onAuthError });
    const client = currentClient();
    client.open();
    client.serverPush(frame);

    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(onAuthError).toHaveBeenCalledWith(reason);
    // 未认证链路被主动关闭，交由退避重连重新认证
    expect(client.readyState).toBe(WebSocket.CLOSED);
  });

  it("已认证连接收到 reauth.err 会回调并保持连接", () => {
    const onAuthError = vi.fn();
    connectChatWs("host-b:8080", "token", () => {}, { onAuthError });
    const client = currentClient();
    client.open();
    client.serverPush(authOkFrame());
    client.serverPush({ type: "reauth.err", id: "req-2", code: 11002 });

    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(onAuthError).toHaveBeenCalledWith("access_token_expired");
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("缺少顶层业务码的 auth.err 不会触发鉴权恢复", () => {
    const onAuthError = vi.fn();
    const handle = connectChatWs("host-no-code:8080", "token", () => {}, { onAuthError });
    const client = currentClient();
    client.open();
    client.serverPush({ type: "auth.err", id: "req-1", error: { reason: "unauthorized" } });

    expect(onAuthError).not.toHaveBeenCalled();
    expect(client.readyState).toBe(WebSocket.OPEN);
    handle.close();
  });

  it("普通命令失败不会触发鉴权恢复", () => {
    const onAuthError = vi.fn();
    const handle = connectChatWs("host-command:8080", "token", () => {}, { onAuthError });
    const client = currentClient();
    client.open();
    client.serverPush(authOkFrame());
    client.serverPush({ type: "command.err", id: "req-2", code: 10001 });

    expect(onAuthError).not.toHaveBeenCalled();
    expect(client.readyState).toBe(WebSocket.OPEN);
    handle.close();
  });

  it("连续 3 次未认证断开只触发一次 onConnectionLost；认证成功后触发一次 onConnectionRestored", async () => {
    const onConnectionLost = vi.fn();
    const onConnectionRestored = vi.fn();
    const events: WsEventEnvelope[] = [];
    connectChatWs("host-c:8080", "token", (env) => events.push(env), {
      onConnectionLost,
      onConnectionRestored,
    });

    // 第 1 次未认证即断开
    currentClient().open();
    currentClient().close();
    await vi.advanceTimersByTimeAsync(2_000);

    // 第 2 次
    currentClient().open();
    currentClient().close();
    await vi.advanceTimersByTimeAsync(4_000);

    expect(onConnectionLost).not.toHaveBeenCalled();

    // 第 3 次 → 达到阈值，通知丢失
    currentClient().open();
    currentClient().close();
    expect(onConnectionLost).toHaveBeenCalledTimes(1);

    // 继续失败不重复通知
    await vi.advanceTimersByTimeAsync(8_000);
    currentClient().open();
    currentClient().close();
    expect(onConnectionLost).toHaveBeenCalledTimes(1);

    // 重连成功并完成认证 → 恢复回调恰好一次
    await vi.advanceTimersByTimeAsync(16_000);
    const recovered = currentClient();
    recovered.open();
    recovered.serverPush(authOkFrame());
    expect(onConnectionRestored).toHaveBeenCalledTimes(1);
  });

  it("pong 判活：多个 ping 无任何入站帧后主动关闭半开链路", async () => {
    const events: WsEventEnvelope[] = [];
    connectChatWs("host-d:8080", "token", (env) => events.push(env));
    const client = currentClient();
    client.open();
    client.serverPush(authOkFrame());

    // t=30s ping#1、t=60s ping#2 —— 尚在容忍窗口内
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.readyState).toBe(WebSocket.OPEN);

    // t=90s：≥2 个 ping 未获回应且空闲超过阈值 → 判死关闭（随后自动重连）
    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.readyState).toBe(WebSocket.CLOSED);
  });

  it("正常收到 pong 时不会误判半开链路", async () => {
    const onConnectionLost = vi.fn();
    connectChatWs("host-e:8080", "token", () => {}, { onConnectionLost });
    const client = currentClient();
    client.open();
    client.serverPush(authOkFrame());

    for (let i = 0; i < 6; i += 1) {
      await vi.advanceTimersByTimeAsync(30_000);
      client.serverPush({ type: "pong", id: null, code: 0 });
    }

    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(onConnectionLost).not.toHaveBeenCalled();
  });
});

describe("wsChatEvents ws_url 归一化", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeWs as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("明文登录链路放行服务端下发的明文 ws_url（端口可不同于登录端口）", () => {
    connectChatWs("http://lan-host:8080", "token", () => {}, {
      wsUrlOverride: "ws://lan-host:18080/api/ws",
    });
    expect(currentClient().url).toBe("ws://lan-host:18080/api/ws");
  });

  it("明文登录链路接受 https 形态 override 并降级为 ws（与登录链路一致）", () => {
    connectChatWs("http://lan-host:8080", "token", () => {}, {
      wsUrlOverride: "http://lan-host:18080/api/ws",
    });
    expect(currentClient().url).toBe("ws://lan-host:18080/api/ws");
  });

  it("HTTPS 登录链路拒绝明文 ws override，回退登录 origin 拼接", () => {
    connectChatWs("https://host-f:8443", "token", () => {}, {
      wsUrlOverride: "ws://host-f:18080/api/ws",
    });
    expect(currentClient().url).toBe("wss://host-f:8443/api/ws");
  });

  it("HTTPS 登录链路接受 wss override（端口可与登录端口不同）", () => {
    connectChatWs("https://host-f:8443", "token", () => {}, {
      wsUrlOverride: "wss://host-f:18080/api/ws",
    });
    expect(currentClient().url).toBe("wss://host-f:18080/api/ws");
  });

  it("跨主机 override 一律拒绝（防 token 重定向到第三方端点）", () => {
    connectChatWs("http://lan-host:8080", "token", () => {}, {
      wsUrlOverride: "ws://evil-host:18080/api/ws",
    });
    expect(currentClient().url).toBe("ws://lan-host:8080/api/ws");
  });
});

describe("wsChatEvents reauth 门控", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeWs as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("未完成认证的连接上 reauth 只更新 token，不发送帧", async () => {
    const clientHandle = connectChatWs("host-g:8080", "token", () => {});
    const client = currentClient();
    client.open();
    await Promise.resolve();
    clientHandle.reauth("token-new");
    const sentTypes = client.sent.map((s) => (JSON.parse(s) as { type: string }).type);
    expect(sentTypes).toEqual(["auth"]);

    // 认证成功后才允许发送 reauth
    client.serverPush(authOkFrame());
    clientHandle.reauth("token-new-2");
    const reauthFrame = client.sent
      .map((s) => JSON.parse(s) as { type: string; data?: { access_token?: string } })
      .find((m) => m.type === "reauth");
    expect(reauthFrame?.data?.access_token).toBe("token-new-2");
  });
});
