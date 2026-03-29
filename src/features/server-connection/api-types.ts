/**
 * @fileoverview server-connection 稳定公共类型出口。
 * @description
 * 统一暴露 server-connection feature 的跨 feature 公共类型，避免调用方深路径依赖各子域实现文件。
 *
 * 约定：
 * - `api.ts` 暴露动作与状态入口；
 * - `api-types.ts` 暴露稳定类型名；
 * - 若类型仅服务于某个子域内部，不应提升到本文件。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type { ServerRack } from "./rack/api";
import type { CurrentServerWorkspaceCleanupHandler } from "./scope-lifecycle/api";
import type { ServerInfo } from "./server-info/domain/types/serverInfo";
import type {
  ServerWorkspaceActivationOutcome,
  ServerWorkspaceConnectOptions,
  ServerWorkspaceConnectionOutcome,
  ServerWorkspaceInfoRefreshOutcome,
  ServerWorkspaceSnapshot,
  ServerWorkspaceSwitchOptions,
} from "./workspace/api";

export type { ConnectionPhase, ConnectionReason } from "./connectivity/api";
export type { ServerRack, ServerTlsConfig } from "./rack/api";
export type { CurrentServerWorkspaceCleanupHandler } from "./scope-lifecycle/api";
export type { ServerInfo } from "./server-info/domain/types/serverInfo";
export type {
  ServerWorkspaceActivationOutcome,
  ServerWorkspaceCommandErrorCode,
  ServerWorkspaceCommandErrorInfo,
  ServerWorkspaceConnectOptions,
  ServerWorkspaceConnectionOutcome,
  ServerWorkspaceInfoRefreshOutcome,
  ServerWorkspaceSnapshot,
  ServerWorkspaceSwitchOptions,
} from "./workspace/api";

/**
 * server-connection runtime lease。
 */
export type ServerConnectionRuntimeLease = {
  /**
   * 释放当前运行时 lease。
   *
   * @returns 释放完成后 resolve。
   */
  release(): Promise<void>;
};

/**
 * server 目录管理能力分组。
 *
 * 说明：
 * - 负责 server 目录写入类动作；
 * - 读取当前 workspace 状态时，调用方应优先通过 `workspace` 分组。
 */
export type ServerConnectionRackCapabilities = {
  /**
   * 新增一个 server 条目到本地目录。
   *
   * @param serverSocket - 新 server 的 socket 地址。
   * @param name - 展示名称。
   * @returns 无返回值。
   */
  addServer(serverSocket: string, name: string): void;
};

/**
 * 当前 server workspace 高层能力分组。
 *
 * 说明：
 * - 这是跨 feature 首选的 server-connection 公共入口；
 * - 统一提供“当前 server workspace”的快照、订阅与命令。
 */
export type ServerConnectionWorkspaceCapabilities = ReadableCapability<ServerWorkspaceSnapshot> & {
  /**
   * 读取当前 server workspace 的 plain snapshot。
   *
   * @returns 当前工作区快照。
   */
  readSocket(): string;

  /**
   * 读取当前 server 对应的 server-info 快照。
   *
   * @returns 当前 server-info；缺失时返回 `null`。
   */
  readInfo(): ServerInfo | null;

  /**
   * 读取服务器目录快照。
   *
   * @returns server 目录列表。
   */
  listDirectory(): readonly ServerRack[];

  /**
   * 读取指定 server 的 TLS 策略。
   *
   * @param serverSocket - 目标服务器 socket。
   * @returns TLS 策略名称。
   */
  readTlsPolicy(serverSocket: string): string;

  /**
   * 选择当前激活的 server workspace。
   *
   * @param serverSocket - 目标服务器 socket。
   * @returns 无返回值。
   */
  selectSocket(serverSocket: string): void;

  /**
   * 切换到指定 server workspace，并按统一策略执行后续连接/刷新。
   *
   * 约定：
   * - `latest-wins`：新的切换命令会覆盖旧的切换流程；
   * - `select -> connect -> refreshInfo` 在同一个目标 socket 上完成；
   * - 调用方优先使用该方法，而不是手工拼装 `select + connect + refreshInfo`。
   *
   * @param serverSocket - 目标服务器 socket。
   * @param options - 切换流程选项。
   * @returns 切换流程完成后 resolve。
   */
  activate(serverSocket: string, options?: ServerWorkspaceSwitchOptions): Promise<ServerWorkspaceActivationOutcome>;

  /**
   * 连接当前选中的 server workspace。
   *
   * @param options - 可选的连接重试参数。
   * @returns 连接流程完成后 resolve。
   */
  connect(options?: ServerWorkspaceConnectOptions): Promise<ServerWorkspaceConnectionOutcome>;

  /**
   * 重试最近一次连接过的 server workspace。
   *
   * @returns 重试流程完成后 resolve。
   */
  retryConnect(): Promise<ServerWorkspaceConnectionOutcome>;

  /**
   * 刷新当前 server 的 server-info。
   *
   * @returns 刷新完成后 resolve。
   */
  refreshInfo(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

/**
 * 当前 server scope 生命周期能力分组。
 *
 * 说明：
 * - 用于注册“切服/清理当前 server scope 时需要额外执行的本地清理动作”；
 * - 适合作为其他 feature 向 server-connection 注入 cleanup hook 的稳定入口。
 */
export type ServerConnectionScopeLifecycleCapabilities = {
  /**
   * 注册当前 server workspace 的清理回调。
   *
   * @param handler - 清理回调。
   * @returns 取消注册函数。
   */
  registerCleanupHandler(handler: CurrentServerWorkspaceCleanupHandler): () => void;
};

/**
 * server-connection 对外稳定 capability 契约。
 *
 * 说明：
 * - 按 `workspace` / `rack` / `scopeLifecycle` 三组能力组织；
 * - 调用方通常应优先从 `workspace` 分组开始，而不是直接依赖子域实现文件。
 */
export type ServerConnectionCapabilities = {
  /**
   * server-connection 运行时能力。
   */
  runtime: {
    /**
     * 获取一个 server-connection runtime lease。
     *
     * 约定：
     * - 多个调用方共享同一个底层 runtime；
     * - 只有最后一个 lease 释放后，底层 runtime 才允许停止。
     *
     * @returns 运行时 lease。
     */
    acquireLease(): Promise<ServerConnectionRuntimeLease>;
  };

  /**
   * 当前 server workspace 的高层公共能力。
   */
  workspace: ServerConnectionWorkspaceCapabilities;

  /**
   * server 目录管理能力。
   */
  rack: ServerConnectionRackCapabilities;

  /**
   * 当前 server scope 生命周期能力。
   */
  scopeLifecycle: ServerConnectionScopeLifecycleCapabilities;
};
