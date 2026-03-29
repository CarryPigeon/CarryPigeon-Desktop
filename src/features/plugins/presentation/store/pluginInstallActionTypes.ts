/**
 * @fileoverview pluginInstallActionTypes.ts
 * @description plugins｜展示层编排：pluginInstallActions 共享类型。
 */

import type { PluginInstallQueryPort } from "@/features/plugins/domain/ports/PluginInstallQueryPort";
import type { PluginLifecycleCommandPort } from "@/features/plugins/domain/ports/PluginLifecycleCommandPort";
import type {
  DisableInput,
  EnableInput,
  RollbackInput,
  SwitchVersionInput,
  UninstallInput,
  UpdateToLatestInput,
} from "@/features/plugins/domain/usecases/ApplyPluginRuntimeOps";
import type {
  InstalledPluginState,
  PluginCatalogEntryLike,
  PluginProgress,
} from "@/features/plugins/domain/types/pluginTypes";
import type { Logger } from "@/shared/utils/logger";
import type { BusyPluginOperationArgs } from "./pluginInstallOperationHelpers";
import type { PluginInstallOperation } from "./pluginInstallOperations";

export type RuntimeOpsUsecase = {
  updateToLatest(input: UpdateToLatestInput): Promise<InstalledPluginState | null>;
  switchVersion(input: SwitchVersionInput): Promise<InstalledPluginState | null>;
  rollback(input: RollbackInput): Promise<InstalledPluginState | null>;
  enable(input: EnableInput): Promise<InstalledPluginState | null>;
  disable(input: DisableInput): Promise<InstalledPluginState | null>;
  uninstall(input: UninstallInput): Promise<void>;
};

export type PluginInstallActionsDeps = {
  key: string;
  queryPort: PluginInstallQueryPort;
  commandPort: PluginLifecycleCommandPort;
  runtimeOpsUsecase: RuntimeOpsUsecase;
  installedById: Record<string, InstalledPluginState>;
  createProgressHandler(targetId: string): (progress: PluginProgress) => void;
  setFailedProgress(pluginId: string, error: unknown): void;
  runBusyPluginOperation(args: BusyPluginOperationArgs): Promise<void>;
  logger: Pick<Logger, "error">;
};

export type PluginInstallActions = {
  install(plugin: PluginCatalogEntryLike, version: string): Promise<void>;
  updateToLatest(plugin: PluginCatalogEntryLike, latestVersion: string): Promise<void>;
  switchVersion(pluginId: string, version: string): Promise<void>;
  rollback(pluginId: string): Promise<void>;
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  uninstall(pluginId: string): Promise<void>;
};

export type { PluginInstallOperation };
