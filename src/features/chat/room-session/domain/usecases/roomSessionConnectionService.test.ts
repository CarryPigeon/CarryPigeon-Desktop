/**
 * @fileoverview roomSessionConnectionService.test.ts
 * @description chat/room-session｜application：连接服务的降级/恢复/重建编排测试。
 */
import { describe, expect, it, vi } from "vitest";
import type { ChatEventsConnectOptions } from "@/features/chat/domain/types/chatEventModels";
import {
  RoomSessionConnectionApplicationService,
  type RoomSessionConnectionApplicationServiceDeps,
} from "./roomSessionConnectionService";

const SOCKET = "sk-1:8080";

type Harness = {
  service: RoomSessionConnectionApplicationService;
  deps: RoomSessionConnectionApplicationServiceDeps;
  wsManager: {
    ensureConnected: ReturnType<typeof vi.fn>;
    forceReconnect: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    isConnectedFor: ReturnType<typeof vi.fn>;
    reauthIfConnectedFor: ReturnType<typeof vi.fn>;
  };
  polling: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    isRunningFor: ReturnType<typeof vi.fn>;
  };
  preferenceCatchUp: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    isRunningFor: ReturnType<typeof vi.fn>;
  };
  lastConnectOptions(): ChatEventsConnectOptions;
};

function buildHarness(initialToken = "t1"): Harness {
  const capturedOptions: ChatEventsConnectOptions[] = [];
  const wsManager = {
    ensureConnected: vi.fn(
      (
        _socket: string,
        _token: string,
        _onEvent: unknown,
        options: ChatEventsConnectOptions,
      ) => {
        capturedOptions.push(options);
        return { reused: false };
      },
    ),
    forceReconnect: vi.fn(
      (
        _socket: string,
        _token: string,
        _onEvent: unknown,
        options: ChatEventsConnectOptions,
      ) => {
        capturedOptions.push(options);
      },
    ),
    close: vi.fn(),
    isConnectedFor: vi.fn(() => false),
    reauthIfConnectedFor: vi.fn(),
  };
  const pollingState = { runningFor: "" };
  const polling = {
    start: vi.fn((key: string) => {
      pollingState.runningFor = key;
    }),
    stop: vi.fn(() => {
      pollingState.runningFor = "";
    }),
    isRunningFor: vi.fn((key: string) => pollingState.runningFor === key),
  };
  const preferenceCatchUp = {
    start: vi.fn(),
    stop: vi.fn(),
    isRunningFor: vi.fn(() => false),
  };

  let token = initialToken;
  const deps: RoomSessionConnectionApplicationServiceDeps = {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
    getSocketAndValidToken: vi.fn(async () => [SOCKET, token] as [string, string]),
    getActiveServerSocket: () => SOCKET,
    getActiveScopeVersion: () => 1,
    refreshChannels: vi.fn(async () => undefined),
    loadChannelMessages: vi.fn(async () => undefined),
    refreshMembersRail: vi.fn(async () => undefined),
    getCurrentChannelId: () => "",
    setCurrentChannelIdIfEmpty: () => undefined,
    getTlsPolicyForSocket: () => "none",
    toHttpOrigin: (socketKey: string) => `http://${socketKey}`,
    getWsUrlOverride: () => undefined,
    isRealtimeAvailable: () => true,
    wsManager: wsManager as never,
    polling: polling as never,
    preferenceCatchUp: preferenceCatchUp as never,
    stopPolling: polling.stop,
    startAutoRefresh: () => ({ stop: () => undefined }),
    onAuthSessionChanged: () => () => undefined,
    onWsEvent: () => undefined,
    onResumeFailed: () => undefined,
  };

  const service = new RoomSessionConnectionApplicationService(deps);
  return {
    service,
    deps,
    wsManager,
    polling,
    preferenceCatchUp,
    lastConnectOptions: () => {
      if (capturedOptions.length === 0) throw new Error("no connect options captured");
      return capturedOptions[capturedOptions.length - 1]!;
    },
  };
}

async function bootstrap(harness: Harness): Promise<void> {
  await harness.service.ensureChatReady();
}

describe("RoomSessionConnectionApplicationService 降级编排", () => {
  it("会话就绪后启动偏好感知补拉调度器", async () => {
    const harness = buildHarness();
    await bootstrap(harness);
    expect(harness.preferenceCatchUp.start).toHaveBeenCalledWith(SOCKET);
  });

  it("新建连接时停止既有 polling（乐观恢复）", async () => {
    const harness = buildHarness();
    harness.polling.isRunningFor.mockReturnValue(true);
    await bootstrap(harness);

    expect(harness.polling.stop).toHaveBeenCalled();
    expect(harness.wsManager.ensureConnected).toHaveBeenCalledTimes(1);
  });

  it("复用句柄时不干预 polling 状态（不误关降级态）", async () => {
    const harness = buildHarness();
    harness.wsManager.ensureConnected.mockReturnValue({ reused: true });
    harness.polling.isRunningFor.mockReturnValue(true);
    await bootstrap(harness);

    expect(harness.polling.stop).not.toHaveBeenCalled();
  });

  it("onConnectionLost 启动 polling 且幂等；onConnectionRestored 停止并可再次进入降级", async () => {
    const harness = buildHarness();
    await bootstrap(harness);
    const options = harness.lastConnectOptions();

    options.onConnectionLost?.();
    expect(harness.polling.start).toHaveBeenCalledTimes(1);
    expect(harness.deps.logger.info).toHaveBeenCalledWith(
      "Action: chat_ws_degraded_to_polling",
      { socket: SOCKET },
    );

    // 已在降级态，重复通知不再重复启动
    options.onConnectionLost?.();
    expect(harness.polling.start).toHaveBeenCalledTimes(1);

    // 恢复 → 停止 polling
    options.onConnectionRestored?.();
    expect(harness.polling.stop).toHaveBeenCalled();

    // 再次丢失可重新降级
    options.onConnectionLost?.();
    expect(harness.polling.start).toHaveBeenCalledTimes(2);
  });

  it("auth 错误且 token 有变化时用新 token 强制重建", async () => {
    const harness = buildHarness("t1");
    await bootstrap(harness);
    const options = harness.lastConnectOptions();

    // 第一次 auth 错误：lastAttempted 为空，t1 视为“新 token”→ 重建
    options.onAuthError?.("unauthorized");
    await vi.waitFor(() => {
      expect(harness.wsManager.forceReconnect).toHaveBeenCalledWith(
        SOCKET,
        "t1",
        expect.any(Function),
        expect.anything(),
      );
    });
    expect(harness.polling.start).not.toHaveBeenCalled();

    // 第二次 auth 错误：token 未变化 → 不再重复重建，转降级轮询
    options.onAuthError?.("unauthorized");
    await vi.waitFor(() => {
      expect(harness.polling.start).toHaveBeenCalledWith(SOCKET);
    });
    expect(harness.wsManager.forceReconnect).toHaveBeenCalledTimes(1);

    // token 轮换后再次 auth 错误 → 用 t2 重建并退出降级
    (harness.deps.getSocketAndValidToken as ReturnType<typeof vi.fn>).mockResolvedValue([
      SOCKET,
      "t2",
    ] as [string, string]);
    options.onAuthError?.("unauthorized");
    await vi.waitFor(() => {
      expect(harness.wsManager.forceReconnect).toHaveBeenLastCalledWith(
        SOCKET,
        "t2",
        expect.any(Function),
        expect.anything(),
      );
    });
    expect(harness.polling.stop).toHaveBeenCalled();
  });

  it("auth 错误但拿不到 token 时直接降级轮询", async () => {
    // bootstrap 阶段需要非空 token 才能走到 WS 分支，之后把取 token 结果切为空来模拟刷新失败。
    const harness = buildHarness("t1");
    await bootstrap(harness);
    (harness.deps.getSocketAndValidToken as ReturnType<typeof vi.fn>).mockResolvedValue([
      SOCKET,
      "",
    ] as [string, string]);

    const options = harness.lastConnectOptions();
    options.onAuthError?.("unauthorized");
    await vi.waitFor(() => {
      expect(harness.polling.start).toHaveBeenCalledWith(SOCKET);
    });
    expect(harness.wsManager.forceReconnect).not.toHaveBeenCalled();
  });
});
