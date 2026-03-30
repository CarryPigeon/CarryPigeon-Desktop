/**
 * @fileoverview chat workspace coordinator
 * @description
 * 收敛 chat 当前工作区的启动、切服、插件桥接与依赖刷新链路，避免页面层手工编排跨 feature 调用顺序。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import type { ServerWorkspaceActivationOutcome } from "@/features/server-connection/api-types";

/**
 * server workspace 协调端口。
 *
 * 该端口只保留 chat 需要的最小工作区动作，避免 chat 直接依赖
 * server-connection feature 的完整公开 API。
 */
export type ChatWorkspacePort = {
  /**
   * 读取当前已选中的 workspace socket。
   */
  getCurrentSocket(): string;
  /**
   * 切换并激活某个 server workspace。
   *
   * 返回值：
   * - 使用 server-connection 已建模的 activation outcome；
   * - chat 不重新发明一套切服语义。
   */
  switchWorkspace(serverSocket: string): Promise<ServerWorkspaceActivationOutcome>;
};

/**
 * 插件运行时协作端口。
 *
 * chat 通过它驱动插件目录刷新、host bridge 对齐与 runtime ensure，
 * 但不感知 plugins feature 的内部 store 结构。
 */
export type ChatPluginRuntimePort = {
  /**
   * 注入或刷新 host bridge。
   *
   * 说明：
   * - 插件 runtime 与 chat UI 的宿主关系发生在 chat 侧；
   * - 因此 bridge 生命周期由 chat workspace 协调器统一控制。
   */
  attachPluginHostBridge(): void;
  refreshCatalog(): Promise<void>;
  refreshDomainCatalog(serverSocket: string): Promise<void>;
  refreshRequiredPluginsState(): Promise<void>;
  ensureRuntime(serverSocket: string): Promise<void>;
  detachBridge(): void;
};

/**
 * chat session 启动端口。
 *
 * 用于把 room-session / message-flow 的预热动作压缩为单个 readiness 命令。
 */
export type ChatSessionBootstrapPort = {
  ensureChatReady(): Promise<void>;
};

/**
 * chat workspace 协调器依赖集合。
 */
export type ChatWorkspaceCoordinatorDeps = {
  workspace: ChatWorkspacePort;
  plugins: ChatPluginRuntimePort;
  session: ChatSessionBootstrapPort;
};

/**
 * chat workspace 命令错误码。
 *
 * 这些错误码覆盖 chat 在切服与首次启动时最核心的失败节点，
 * 让页面层能稳定区分“缺少输入”“切服失败”“插件未就绪”等语义。
 */
export type ChatWorkspaceCommandErrorCode =
  | "missing_workspace_socket"
  | "workspace_activation_rejected"
  | "plugin_catalog_refresh_failed"
  | "plugin_domain_catalog_refresh_failed"
  | "plugin_required_state_refresh_failed"
  | "plugin_runtime_ensure_failed"
  | "chat_session_ready_failed";

/**
 * chat workspace 命令错误信息。
 */
export type ChatWorkspaceCommandErrorInfo = SemanticErrorInfo<ChatWorkspaceCommandErrorCode>;

/**
 * 当前工作区启动结果。
 */
export type ChatWorkspaceBootstrapOutcome =
  | SuccessOutcome<"chat_workspace_bootstrapped", { serverSocket: string }>
  | FailureOutcome<"chat_workspace_bootstrap_rejected", ChatWorkspaceCommandErrorCode>;

/**
 * 工作区切换结果。
 */
export type ChatWorkspaceSwitchOutcome =
  | SuccessOutcome<"chat_workspace_switched", { serverSocket: string }>
  | FailureOutcome<"chat_workspace_switch_rejected", ChatWorkspaceCommandErrorCode>;

/**
 * chat 根层工作区协调 capability。
 *
 * 它承接 chat 根模块需要的跨 feature 编排，但不向页面层暴露底层步骤。
 */
export type ChatWorkspaceCoordinator = {
  /**
   * 启动当前已选中的 workspace。
   *
   * 典型调用时机：
   * - Patchbay 首页首次进入；
   * - 页面重建后恢复当前 socket。
   */
  bootstrapCurrentWorkspace(): Promise<ChatWorkspaceBootstrapOutcome>;
  /**
   * 切换到新的 workspace。
   *
   * 说明：
   * - 返回显式 `Outcome`；
   * - 页面层自行决定如何投影失败。
   */
  switchWorkspace(serverSocket: string): Promise<ChatWorkspaceSwitchOutcome>;
  /**
   * 根据当前 socket 同步插件 host bridge。
   */
  syncBridgeForCurrentSocket(): void;
  /**
   * 清理 chat workspace 协调器持有的宿主资源。
   */
  dispose(): void;
};

/**
 * 构建 chat 工作区协调器。
 */
export function createChatWorkspaceCoordinator(deps: ChatWorkspaceCoordinatorDeps): ChatWorkspaceCoordinator {
  function createWorkspaceCommandError(
    code: ChatWorkspaceCommandErrorCode,
    fallbackMessage: string,
    error?: unknown,
    details?: Readonly<Record<string, unknown>>,
  ): ChatWorkspaceCommandErrorInfo {
    const semanticLike =
      error && typeof error === "object" && "message" in error
        ? (error as { message?: unknown; retryable?: unknown; code?: unknown })
        : null;

    return {
      code,
      message:
        typeof semanticLike?.message === "string" && semanticLike.message.trim()
          ? semanticLike.message
          : error instanceof Error
            ? error.message || fallbackMessage
            : String(error ?? "") || fallbackMessage,
      retryable:
        typeof semanticLike?.retryable === "boolean"
          ? semanticLike.retryable
          : code !== "missing_workspace_socket",
      details: {
        ...(details ?? {}),
        ...(semanticLike && typeof semanticLike.code === "string" ? { sourceCode: semanticLike.code } : {}),
      },
    };
  }

  function rejectWorkspaceCommand<TFailureKind extends string>(
    kind: TFailureKind,
    code: ChatWorkspaceCommandErrorCode,
    fallbackMessage: string,
    error?: unknown,
    details?: Readonly<Record<string, unknown>>,
  ): FailureOutcome<TFailureKind, ChatWorkspaceCommandErrorCode> {
    return {
      ok: false,
      kind,
      error: createWorkspaceCommandError(code, fallbackMessage, error, details),
    };
  }

  /**
   * 运行 chat 对某个 workspace 的标准启动流水线。
   *
   * 顺序固定：
   * 1. 激活 server workspace
   * 2. 刷新插件目录
   * 3. 刷新消息 domain 目录
   * 4. 刷新 required 状态
   * 5. 确保插件 runtime 已就绪
   * 6. 确保 chat session 已就绪
   *
   * 设计原因：
   * - 这些步骤跨越 server-connection / plugins / chat/session 三个 feature/子域；
   * - 若散落在页面层，会迅速演化为隐式编排脚本。
   */
  async function runWorkspacePipeline<TSuccessKind extends string, TFailureKind extends string>(
    serverSocket: string,
    successKind: TSuccessKind,
    failureKind: TFailureKind,
  ): Promise<SuccessOutcome<TSuccessKind, { serverSocket: string }> | FailureOutcome<TFailureKind, ChatWorkspaceCommandErrorCode>> {
    const socket = String(serverSocket ?? "").trim();
    if (!socket) {
      return rejectWorkspaceCommand(failureKind, "missing_workspace_socket", "Missing workspace socket.");
    }
    const activationOutcome = await deps.workspace.switchWorkspace(socket);
    if (!activationOutcome.ok) {
      return rejectWorkspaceCommand(
        failureKind,
        "workspace_activation_rejected",
        "Failed to activate workspace.",
        activationOutcome.error,
        { serverSocket: socket },
      );
    }
    try {
      await deps.plugins.refreshCatalog();
    } catch (error) {
      return rejectWorkspaceCommand(
        failureKind,
        "plugin_catalog_refresh_failed",
        "Failed to refresh plugin catalog.",
        error,
        { serverSocket: socket },
      );
    }
    try {
      await deps.plugins.refreshDomainCatalog(socket);
    } catch (error) {
      return rejectWorkspaceCommand(
        failureKind,
        "plugin_domain_catalog_refresh_failed",
        "Failed to refresh message domain catalog.",
        error,
        { serverSocket: socket },
      );
    }
    try {
      await deps.plugins.refreshRequiredPluginsState();
    } catch (error) {
      return rejectWorkspaceCommand(
        failureKind,
        "plugin_required_state_refresh_failed",
        "Failed to refresh required plugin state.",
        error,
        { serverSocket: socket },
      );
    }
    try {
      await deps.plugins.ensureRuntime(socket);
    } catch (error) {
      return rejectWorkspaceCommand(
        failureKind,
        "plugin_runtime_ensure_failed",
        "Failed to ensure chat plugin runtime.",
        error,
        { serverSocket: socket },
      );
    }
    try {
      await deps.session.ensureChatReady();
    } catch (error) {
      return rejectWorkspaceCommand(
        failureKind,
        "chat_session_ready_failed",
        "Failed to ensure chat session readiness.",
        error,
        { serverSocket: socket },
      );
    }
    return {
      ok: true,
      kind: successKind,
      serverSocket: socket,
    };
  }

  /**
   * 把当前 socket 对应的 plugin host bridge 对齐到 chat 页面。
   */
  function syncBridgeForCurrentSocket(): void {
    deps.plugins.attachPluginHostBridge();
  }

  async function bootstrapCurrentWorkspace(): Promise<ChatWorkspaceBootstrapOutcome> {
    syncBridgeForCurrentSocket();
    return runWorkspacePipeline(
      deps.workspace.getCurrentSocket(),
      "chat_workspace_bootstrapped",
      "chat_workspace_bootstrap_rejected",
    );
  }

  async function switchWorkspace(serverSocket: string): Promise<ChatWorkspaceSwitchOutcome> {
    syncBridgeForCurrentSocket();
    return runWorkspacePipeline(
      serverSocket,
      "chat_workspace_switched",
      "chat_workspace_switch_rejected",
    );
  }

  function dispose(): void {
    deps.plugins.detachBridge();
  }

  return {
    bootstrapCurrentWorkspace,
    switchWorkspace,
    syncBridgeForCurrentSocket,
    dispose,
  };
}
