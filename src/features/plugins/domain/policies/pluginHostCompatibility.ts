/**
 * @fileoverview 插件宿主版本兼容策略。
 * @description plugins｜domain policy：校验插件 min_host_version。
 */

import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";

/**
 * 桌面宿主版本。
 *
 * 说明：该值与 `src-tauri/tauri.conf.json` 的应用版本保持一致。
 */
export const PLUGIN_HOST_APP_VERSION = "0.1.1";

function parseVersion(raw: string): number[] {
  return String(raw ?? "")
    .trim()
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^\d].*$/u, ""), 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

/**
 * 比较版本号。
 *
 * @returns 当前版本大于等于要求版本则为 true。
 */
export function isHostVersionCompatible(currentVersion: string, minHostVersion: string): boolean {
  const min = String(minHostVersion ?? "").trim();
  if (!min) return true;
  const currentParts = parseVersion(currentVersion);
  const minParts = parseVersion(min);
  const len = Math.max(currentParts.length, minParts.length, 3);
  for (let i = 0; i < len; i += 1) {
    const current = currentParts[i] ?? 0;
    const required = minParts[i] ?? 0;
    if (current > required) return true;
    if (current < required) return false;
  }
  return true;
}

/**
 * 校验 runtime 入口是否兼容当前宿主。
 */
export function assertPluginRuntimeHostCompatible(runtime: PluginRuntimeEntry): void {
  const minHostVersion = String(runtime.minHostVersion ?? "").trim();
  if (isHostVersionCompatible(PLUGIN_HOST_APP_VERSION, minHostVersion)) return;
  throw new Error(
    `Plugin ${runtime.pluginId}@${runtime.version} requires host ${minHostVersion}, current host is ${PLUGIN_HOST_APP_VERSION}.`,
  );
}
