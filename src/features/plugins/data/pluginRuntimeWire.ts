/**
 * @fileoverview plugins runtime wire models and mappers。
 * @description
 * 收敛 Rust/Tauri runtime entry 的 wire 形状，避免 snake_case 协议字段泄漏到 domain/public contracts。
 */

import type { PluginRuntimeEntry, RuntimeProvidesDomain } from "../domain/types/pluginTypes";

export type RawRuntimeProvidesDomain = {
  domain: string;
  domain_version: string;
};

export type RawPluginRuntimeEntry = {
  serverId: string;
  pluginId: string;
  version: string;
  entry: string;
  permissions: string[];
  providesDomains: RawRuntimeProvidesDomain[];
  minHostVersion: string;
  /** 入口 API 版本；旧宿主可能缺省，按 1 处理。 */
  entryApiVersion?: number;
  /** IPC 白名单前缀；旧宿主可能缺省，按空处理。 */
  ipcPrefixes?: string[];
};

function toTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function mapRuntimeProvidesDomain(input: RawRuntimeProvidesDomain): RuntimeProvidesDomain {
  return {
    domain: toTrimmedString(input.domain),
    domainVersion: toTrimmedString(input.domain_version) || "1.0.0",
  };
}

export function mapPluginRuntimeEntry(input: RawPluginRuntimeEntry): PluginRuntimeEntry {
  return {
    serverId: toTrimmedString(input.serverId),
    pluginId: toTrimmedString(input.pluginId),
    version: toTrimmedString(input.version),
    entry: toTrimmedString(input.entry),
    permissions: Array.isArray(input.permissions) ? input.permissions.map((item) => toTrimmedString(item)).filter(Boolean) : [],
    providesDomains: Array.isArray(input.providesDomains) ? input.providesDomains.map(mapRuntimeProvidesDomain) : [],
    minHostVersion: toTrimmedString(input.minHostVersion),
    // 仅显式声明 >= 2 才按 Cordis 契约处理，其余（含缺失/非法）一律回退传统契约。
    entryApiVersion: Number(input.entryApiVersion) >= 2 ? 2 : 1,
    ipcPrefixes: Array.isArray(input.ipcPrefixes)
      ? input.ipcPrefixes.map((item) => toTrimmedString(item)).filter(Boolean)
      : [],
  };
}
