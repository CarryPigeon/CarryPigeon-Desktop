/**
 * @fileoverview clearCurrentServerWorkspaceFlow.ts
 * @description server-connection/scope-lifecycle｜应用层内部流程：清理当前 server scope 本地数据。
 */

import type { Logger } from "@/shared/utils/logger";
import { toClearCurrentServerWorkspaceStepError } from "./ClearCurrentServerWorkspaceError";

export type ClearCurrentServerWorkspaceStep =
  | "refresh_server_info"
  | "clear_local_auth"
  | "clear_mock_plugins"
  | "remove_server_db"
  | "forget_server_identity"
  | "reset_current_workspace_selection"
  | "run_post_clear_hooks";

export type ClearCurrentServerWorkspaceDeps = {
  logger: Pick<Logger, "warn">;
  refreshServerInfo: () => Promise<void>;
  clearLocalAuth: () => Promise<void> | void;
  clearMockPlugins: () => Promise<void> | void;
  removeServerDb: () => Promise<void> | void;
  forgetServerIdentity: () => Promise<void> | void;
  resetCurrentWorkspaceSelection: () => Promise<void> | void;
  runPostClearHooks: () => Promise<void> | void;
};

type FlowStep = {
  id: ClearCurrentServerWorkspaceStep;
  critical: boolean;
  run(deps: ClearCurrentServerWorkspaceDeps): Promise<void> | void;
};

async function runStep(
  deps: ClearCurrentServerWorkspaceDeps,
  step: ClearCurrentServerWorkspaceStep,
  fn: () => Promise<void> | void,
  critical: boolean,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (critical) throw toClearCurrentServerWorkspaceStepError(step, error);
    deps.logger.warn("Action: api_server_workspace_clear_step_non_critical_failed", { step, error: String(error) });
  }
}

const FLOW_STEPS: readonly FlowStep[] = [
  { id: "refresh_server_info", critical: false, run: (deps) => deps.refreshServerInfo() },
  { id: "clear_local_auth", critical: true, run: (deps) => deps.clearLocalAuth() },
  { id: "clear_mock_plugins", critical: true, run: (deps) => deps.clearMockPlugins() },
  { id: "remove_server_db", critical: true, run: (deps) => deps.removeServerDb() },
  { id: "forget_server_identity", critical: true, run: (deps) => deps.forgetServerIdentity() },
  { id: "reset_current_workspace_selection", critical: true, run: (deps) => deps.resetCurrentWorkspaceSelection() },
  { id: "run_post_clear_hooks", critical: true, run: (deps) => deps.runPostClearHooks() },
] as const;

/**
 * 执行“清理当前 server scope 本地数据”编排。
 */
export async function clearCurrentServerWorkspaceFlow(deps: ClearCurrentServerWorkspaceDeps): Promise<void> {
  for (const step of FLOW_STEPS) {
    await runStep(deps, step.id, () => step.run(deps), step.critical);
  }
}
