/**
 * @fileoverview Compile-time contract checks for plugin permission confirmation helpers.
 */

import {
  buildSensitivePermissionMessage,
  collectSensitivePermissionLabels,
  collectSensitivePermissionLabelsForVersion,
} from "../presentation/store/pluginPermissionGuard";
import type { PluginCatalogEntryLike } from "@/features/plugins/domain/types/pluginTypes";

const versionAwarePlugin = {
  pluginId: "demo.plugin",
  name: "Demo Plugin",
  tagline: "Demo",
  description: "Demo plugin used for compile-time checks.",
  source: "server",
  downloadUrl: "",
  sha256: "",
  required: false,
  versions: ["1.2.3"],
  providesDomains: [],
  permissions: [
    { key: "network", label: "Network", risk: "high" },
    { key: "cache", label: "Cache", risk: "low" },
    { key: "storage", label: "Storage", risk: "medium" },
  ],
  versionEntries: [
    {
      version: "1.2.3",
      source: "server",
      downloadUrl: "",
      sha256: "",
    },
  ],
} satisfies PluginCatalogEntryLike;

const sensitiveLabels = collectSensitivePermissionLabels(versionAwarePlugin);

export const pluginPermissionGuardLabelsContractCheck: readonly string[] = sensitiveLabels;

export const pluginPermissionGuardVersionLabelsContractCheck: readonly string[] = collectSensitivePermissionLabelsForVersion(
  versionAwarePlugin,
  [{ key: "network", label: "Network", risk: "high" }],
);

export const pluginPermissionGuardMessageContractCheck: string = buildSensitivePermissionMessage({
  operationLabel: "Install",
  pluginId: "demo.plugin",
  targetVersion: "1.2.3",
  sensitivePermissions: sensitiveLabels,
});
