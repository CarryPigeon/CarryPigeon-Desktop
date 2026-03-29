/**
 * @fileoverview 插件运行时模块规范化工具。
 * @description plugins｜runtime：module normalizers（纯函数）。
 */

import type { Component } from "vue";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginRuntimeContract } from "@/features/plugins/domain/types/pluginRuntimeTypes";

type RawRecord = Record<string, unknown>;

type RawPluginContract = {
  domain?: unknown;
  domainVersion?: unknown;
  domain_version?: unknown;
  payloadSchema?: unknown;
  payload_schema?: unknown;
  constraints?: unknown;
};

function toNonEmptyString(raw: unknown): string {
  return String(raw ?? "").trim();
}

/**
 * 规范化 runtime 提供的 domain 列表（`Raw DTO` -> `Model`）。
 */
export function normalizeRuntimeProvidesDomains(
  runtime: PluginRuntimeEntry,
): Array<{ domain: string; domainVersion: string }> {
  if (!Array.isArray(runtime.providesDomains)) return [];
  return runtime.providesDomains.map((d) => {
    const raw = d as unknown as RawRecord;
    return {
      domain: toNonEmptyString(raw.domain),
      domainVersion: toNonEmptyString(raw.domainVersion ?? raw.domain_version) || "1.0.0",
    };
  });
}

/**
 * 规范化插件 contracts（边界兼容 snake_case，领域内统一 camelCase）。
 */
export function normalizeRuntimeContracts(rawContracts: unknown): PluginRuntimeContract[] {
  if (!Array.isArray(rawContracts)) return [];
  const normalized: PluginRuntimeContract[] = [];
  for (const item of rawContracts) {
    const raw = (item ?? {}) as RawPluginContract;
    const domain = toNonEmptyString(raw.domain);
    if (!domain) continue;
    normalized.push({
      domain,
      domainVersion: toNonEmptyString(raw.domainVersion ?? raw.domain_version) || "1.0.0",
      payloadSchema: raw.payloadSchema ?? raw.payload_schema,
      constraints: raw.constraints,
    });
  }
  return normalized;
}

/**
 * 规范化插件组件导出映射（renderers/composers）。
 */
export function normalizeComponentRecord(raw: unknown): Record<string, Component> {
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, Component>;
}
