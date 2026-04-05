/**
 * @fileoverview clearCurrentServerWorkspaceFlow.ts
 * @description server-connection/scope-lifecycle｜应用层内部流程：清理当前 server scope 本地数据。
 *
 * 设计说明：
 * - 负责定义和执行完整的清理流程编排
 * - 支持关键步骤和非关键步骤的区分
 * - 提供详细的错误处理和恢复机制
 *
 * 架构位置：
 * - 属于 server-connection/scope-lifecycle 子域
 * - 被 ClearCurrentServerWorkspace 用例调用
 * - 是子域内部的流程实现
 */

import type { Logger } from "@/shared/utils/logger";
import { toClearCurrentServerWorkspaceStepError } from "./ClearCurrentServerWorkspaceError";

/**
 * 清理 server workspace 流程的步骤枚举
 *
 * 每个步骤代表一个独立的清理操作
 * 按顺序执行，确保资源正确释放
 */
export type ClearCurrentServerWorkspaceStep =
  | "clear_local_auth"
  | "clear_mock_plugins"
  | "remove_server_db"
  | "forget_server_identity"
  | "reset_current_workspace_selection"
  | "run_post_clear_hooks";

/**
 * 清理 server workspace 流程的依赖接口
 *
 * 提供所有清理步骤所需的具体实现函数
 * 支持同步或异步操作
 */
export type ClearCurrentServerWorkspaceDeps = {
  /** 日志记录器 */
  logger: Pick<Logger, "warn">;
  /** 清理本地认证信息 */
  clearLocalAuth: () => Promise<void> | void;
  /** 清理 mock 插件状态 */
  clearMockPlugins: () => Promise<void> | void;
  /** 移除服务器数据库 */
  removeServerDb: () => Promise<void> | void;
  /** 清除服务器身份信息 */
  forgetServerIdentity: () => Promise<void> | void;
  /** 重置当前工作区选择 */
  resetCurrentWorkspaceSelection: () => Promise<void> | void;
  /** 运行清理后的钩子函数 */
  runPostClearHooks: () => Promise<void> | void;
};

/**
 * 流程步骤的内部定义
 *
 * 包含步骤标识、是否为关键步骤和执行函数
 */
type FlowStep = {
  /** 步骤标识符 */
  id: ClearCurrentServerWorkspaceStep;
  /** 是否为关键步骤（失败会中断整个流程） */
  critical: boolean;
  /** 步骤执行函数 */
  run(deps: ClearCurrentServerWorkspaceDeps): Promise<void> | void;
};

/**
 * 执行单个清理步骤的辅助函数
 *
 * 错误处理策略：
 * - 关键步骤失败：抛出错误，中断整个流程
 * - 非关键步骤失败：记录警告日志，继续执行后续步骤
 *
 * @param deps 流程依赖对象
 * @param step 步骤标识符
 * @param fn 步骤执行函数
 * @param critical 是否为关键步骤
 * @returns Promise<void>
 */
async function runStep(
  deps: ClearCurrentServerWorkspaceDeps,
  step: ClearCurrentServerWorkspaceStep,
  fn: () => Promise<void> | void,
  critical: boolean,
): Promise<void> {
  try {
    // 执行步骤
    await fn();
  } catch (error) {
    // 根据是否为关键步骤决定错误处理策略
    if (critical) {
      // 关键步骤失败，抛出错误中断流程
      throw toClearCurrentServerWorkspaceStepError(step, error);
    }
    // 非关键步骤失败，记录警告日志继续执行
    deps.logger.warn("Action: api_server_workspace_clear_step_non_critical_failed", { step, error: String(error) });
  }
}

/**
 * 清理 server workspace 的完整流程定义
 *
 * 流程说明：
 * 1. 清理本地认证信息
 * 2. 清理 mock 插件状态
 * 3. 移除服务器数据库
 * 4. 清除服务器身份信息
 * 5. 重置当前工作区选择
 * 6. 运行清理后的钩子函数
 *
 * 所有步骤都标记为关键步骤，确保完整清理
 */
const FLOW_STEPS: readonly FlowStep[] = [
  { id: "clear_local_auth", critical: true, run: (deps) => deps.clearLocalAuth() },
  { id: "clear_mock_plugins", critical: true, run: (deps) => deps.clearMockPlugins() },
  { id: "remove_server_db", critical: true, run: (deps) => deps.removeServerDb() },
  { id: "forget_server_identity", critical: true, run: (deps) => deps.forgetServerIdentity() },
  { id: "reset_current_workspace_selection", critical: true, run: (deps) => deps.resetCurrentWorkspaceSelection() },
  { id: "run_post_clear_hooks", critical: true, run: (deps) => deps.runPostClearHooks() },
] as const;

/**
 * 执行“清理当前 server scope 本地数据”的完整流程编排
 *
 * 功能说明：
 * 1. 按顺序执行所有清理步骤
 * 2. 管理步骤之间的依赖关系
 * 3. 提供统一的错误处理机制
 * 4. 确保资源正确释放
 *
 * @param deps 流程依赖对象
 * @returns Promise<void>
 * @throws ClearCurrentServerWorkspaceStepError 当关键步骤失败时抛出
 */
export async function clearCurrentServerWorkspaceFlow(deps: ClearCurrentServerWorkspaceDeps): Promise<void> {
  for (const step of FLOW_STEPS) {
    // 执行每个步骤
    await runStep(deps, step.id, () => step.run(deps), step.critical);
  }
}
