/**
 * @fileoverview ClearCurrentServerWorkspace
 * @description server-connection/scope-lifecycle｜应用层用例：清理当前 server scope 本地数据。
 *
 * 功能说明：
 * - 负责协调并执行当前服务器工作区的完整清理流程
 * - 包括本地认证信息、插件状态、数据库、服务器身份等的清理
 * - 采用依赖注入设计，便于测试和扩展
 *
 * 架构位置：
 * - 属于 server-connection/scope-lifecycle 子域
 * - 被 workspace 子域作为高层能力暴露
 * - 是跨 feature 调用的统一入口
 */

import { removeServerDb } from "@/shared/db";
import { clearMockPluginsState } from "@/shared/mock/mockPluginState";
import { forgetServerIdentity, getServerScopeKey } from "@/shared/serverIdentity";
import { clearAuthAndResumeState } from "@/shared/utils/localState";
import { createLogger, type Logger } from "@/shared/utils/logger";
import { selectRackSocket } from "@/features/server-connection/rack/application/rackDirectoryService";
import { ClearCurrentServerWorkspaceError } from "./ClearCurrentServerWorkspaceError";
import { clearCurrentServerWorkspaceFlow } from "./clearCurrentServerWorkspaceFlow";
import { runCurrentServerWorkspaceCleanupHandlers } from "./currentServerWorkspaceCleanupHandlers";

/**
 * 清理当前 server workspace 的依赖接口
 *
 * 设计说明：
 * - 采用依赖注入模式，便于测试和替换实现
 * - 每个依赖函数都是一个独立的清理动作
 * - 支持同步或异步操作
 */
type ClearCurrentServerWorkspaceDeps = {
  /** 日志记录器，用于记录非关键步骤的警告 */
  logger: Pick<Logger, "warn">;
  /** 清理本地认证和恢复状态 */
  clearLocalAuth(serverSocket: string): Promise<void> | void;
  /** 清理 mock 插件状态 */
  clearMockPlugins(serverSocket: string, scopeKey: string): Promise<void> | void;
  /** 删除服务器数据库 */
  removeServerDb(serverSocket: string): Promise<void> | void;
  /** 清除服务器身份信息 */
  forgetServerIdentity(serverSocket: string): Promise<void> | void;
  /** 重置当前工作区选择 */
  resetCurrentWorkspaceSelection(): Promise<void> | void;
  /** 运行清理后的钩子函数 */
  runPostClearHooks(): Promise<void> | void;
};

/** 清理 server workspace 的可选参数（用于覆盖默认实现） */
type ClearCurrentServerWorkspaceOptions = Partial<ClearCurrentServerWorkspaceDeps>;

/**
 * 创建清理 server workspace 的默认依赖实现
 *
 * 功能说明：
 * - 提供所有清理步骤的默认实现
 * - 使用实际的生产环境函数
 * - 可通过传入 ClearCurrentServerWorkspaceOptions 进行覆盖
 *
 * @returns 默认依赖实现
 */
function createDefaultDeps(): ClearCurrentServerWorkspaceDeps {
  return {
    logger: createLogger("ClearCurrentServerWorkspace"),
    clearLocalAuth: (serverSocket: string) => clearAuthAndResumeState(serverSocket),
    clearMockPlugins: (serverSocket: string, scopeKey: string) => {
      clearMockPluginsState(serverSocket);
      // 如果 scope key 与 server socket 不同，也要清理 scope key 对应的状态
      if (scopeKey && scopeKey !== serverSocket) clearMockPluginsState(scopeKey);
    },
    removeServerDb: (serverSocket: string) => removeServerDb(serverSocket),
    forgetServerIdentity: (serverSocket: string) => forgetServerIdentity(serverSocket),
    resetCurrentWorkspaceSelection: () => selectRackSocket(""),
    runPostClearHooks: () => runCurrentServerWorkspaceCleanupHandlers(),
  };
}

/**
 * 清理当前 server scope 本地数据的应用层用例类
 *
 * 架构说明：
 * - 这是 server-connection 特性的应用层用例
 * - 采用依赖注入设计，便于单元测试和功能扩展
 * - 负责协调执行完整的清理流程
 */
export class ClearCurrentServerWorkspace {
  /** 内部依赖对象 */
  private readonly deps: ClearCurrentServerWorkspaceDeps;

  /**
   * 构造函数
   *
   * @param deps 可选参数，用于覆盖默认依赖实现
   */
  constructor(deps: ClearCurrentServerWorkspaceOptions = {}) {
    // 合并默认依赖与用户提供的依赖
    this.deps = { ...createDefaultDeps(), ...deps };
  }

  /**
   * 执行清理流程的主入口点
   *
   * 流程说明：
   * 1. 验证输入参数
   * 2. 计算 server scope key
   * 3. 构建流程依赖
   * 4. 执行实际的清理流程
   *
   * @param serverSocket 要清理的服务器 socket 地址
   * @returns Promise<void>
   * @throws ClearCurrentServerWorkspaceError 当缺少服务器 socket 时抛出
   */
  async execute(serverSocket: string): Promise<void> {
    // 标准化输入参数
    const socket = String(serverSocket ?? "").trim();

    // 参数验证
    if (!socket) {
      throw new ClearCurrentServerWorkspaceError({
        code: "missing_server_socket",
        message: "缺少服务器 socket 地址",
      });
    }

    // 获取服务器 scope key（用于插件隔离）
    const scopeKey = getServerScopeKey(socket);

    // 构建流程依赖并执行清理
    await clearCurrentServerWorkspaceFlow(this.buildFlowDeps(socket, scopeKey));
  }

  /**
   * 构建清理流程所需的依赖对象
   *
   * 功能说明：
   * 将外部依赖转换为流程内部使用的格式
   * 部分依赖需要绑定 server socket 和 scope key 参数
   *
   * @param socket 服务器 socket 地址
   * @param scopeKey 服务器 scope key
   * @returns 流程内部使用的依赖对象
   */
  private buildFlowDeps(socket: string, scopeKey: string) {
    return {
      logger: this.deps.logger,
      clearLocalAuth: () => this.deps.clearLocalAuth(socket),
      clearMockPlugins: () => this.deps.clearMockPlugins(socket, scopeKey),
      removeServerDb: () => this.deps.removeServerDb(socket),
      forgetServerIdentity: () => this.deps.forgetServerIdentity(socket),
      resetCurrentWorkspaceSelection: () => this.deps.resetCurrentWorkspaceSelection(),
      runPostClearHooks: () => this.deps.runPostClearHooks(),
    };
  }
}
