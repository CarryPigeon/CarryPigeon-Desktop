/**
 * @fileoverview plugins｜presentation helper：sensitive permission confirmation text.
 */

import type { PluginCatalogEntryLike, PluginPermission } from "@/features/plugins/domain/types/pluginTypes";

const SENSITIVE_PERMISSION_RISKS = new Set(["high", "medium"]);

export type SensitivePermissionMessageInput = {
  operationLabel: "Install" | "Update" | "Switch";
  pluginId: string;
  targetVersion: string;
  sensitivePermissions: readonly string[];
};

function collectSensitiveLabels(permissions: readonly PluginPermission[]): string[] {
  return permissions
    .filter((permission) => SENSITIVE_PERMISSION_RISKS.has(permission.risk))
    .map((permission) => permission.label || permission.key)
    .filter(Boolean);
}

export function collectSensitivePermissionLabels(plugin: PluginCatalogEntryLike): string[] {
  return collectSensitiveLabels(plugin.permissions ?? []);
}

export function collectSensitivePermissionLabelsForVersion(
  plugin: PluginCatalogEntryLike,
  versionPermissions: readonly PluginPermission[] | null,
): string[] {
  return collectSensitiveLabels(versionPermissions ?? plugin.permissions ?? []);
}

export function buildSensitivePermissionMessage(input: SensitivePermissionMessageInput): string {
  return [
    `${input.operationLabel} ${input.pluginId} to ${input.targetVersion}?`,
    `This version requests sensitive permissions: ${input.sensitivePermissions.join(", ")}.`,
  ].join("\n");
}
