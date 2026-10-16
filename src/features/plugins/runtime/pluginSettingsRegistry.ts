/**
 * @fileoverview plugins 运行时：插件设置项注册表（宿主共享）。
 * @description
 * 每个 server 一份，承载「插件 → 设置项」的注册。插件通过 `ctx.ui.registerSettingsItem`
 * 写入，插件 fiber 销毁时由 `createUiService` 的 `ctx.effect` 自动反注册（store 停用插件时
 * 另有 `unregister` 兜底）。
 *
 * 该注册表是纯数据（数组），由 domainRegistryStore 投影到 Vue 响应式的
 * `pluginSettingsItems` 供设置页消费；注册表本身不依赖 Vue。
 */

import type { Component } from "vue";
import type {
  PluginSettingsContribution,
  PluginSettingsItemInput,
} from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { PLUGIN_SETTINGS_ITEM_ID_PATTERN } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("pluginSettingsRegistry");

/** 单插件允许注册的设置项上限（防止插件把设置页塞满）。 */
export const PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN = 20;

export type PluginSettingsRegistry = {
  /**
   * 注册/替换一个设置项。
   *
   * @param pluginId - 注册方插件 id（宿主权威来源）。
   * @param input - 设置项声明（含控件组件）。
   * @returns 反注册函数（幂等；重复调用无副作用）。
   */
  register(pluginId: string, input: PluginSettingsItemInput): () => void;
  /** 反注册某插件的全部设置项（停用插件兜底清理）。 */
  unregister(pluginId: string): void;
  /** 列出全部设置项（浅拷贝；按 order → pluginId → 注册序排序）。 */
  list(): PluginSettingsContribution[];
  /** 清空注册表（仅供测试重置）。 */
  clear(): void;
};

/**
 * 规范化设置项 id / 标题。
 *
 * @param value - 原始字符串。
 * @returns trim 后的字符串。
 */
function normalize(value: string | undefined): string {
  return String(value ?? "").trim();
}

/**
 * 规范化关键词列表（trim + 去空 + 去重，保持首次出现顺序）。
 *
 * @param keywords - 原始关键词列表。
 * @returns 规范化后的只读关键词列表。
 */
function normalizeKeywords(keywords: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of keywords ?? []) {
    const key = normalize(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * 规范化排序值（非有限数按 0 处理）。
 *
 * @param order - 原始排序值。
 * @returns 有限数排序值。
 */
function normalizeOrder(order: number | undefined): number {
  const value = Number(order);
  return Number.isFinite(value) ? value : 0;
}

/**
 * 创建插件设置项注册表。
 *
 * @param serverSocket - 该注册表所属的归一化 server key（写入每条记录，便于诊断与过滤）。
 * @returns 注册表实例。
 */
export function createPluginSettingsRegistry(serverSocket = ""): PluginSettingsRegistry {
  const ownerSocket = normalize(serverSocket);
  /** 存储项：含注册序号，用于稳定排序。 */
  type Entry = PluginSettingsContribution & { readonly seq: number };

  const entries = new Map<string, Entry>();
  let seq = 0;

  /**
   * 组装注册表 key（插件 id + 设置项 id）。
   *
   * @param pluginId - 插件 id。
   * @param itemId - 设置项 id。
   * @returns 唯一 key。
   */
  function entryKey(pluginId: string, itemId: string): string {
    return `${pluginId}\u0000${itemId}`;
  }

  /**
   * 统计某插件当前已注册的设置项数量。
   *
   * @param pluginId - 插件 id。
   * @returns 已注册数量。
   */
  function countOf(pluginId: string): number {
    let count = 0;
    for (const entry of entries.values()) {
      if (entry.pluginId === pluginId) count += 1;
    }
    return count;
  }

  return {
    register(pluginId: string, input: PluginSettingsItemInput): () => void {
      const id = normalize(pluginId);
      const itemId = normalize(input?.id);
      const title = normalize(input?.title);
      if (!id || !PLUGIN_SETTINGS_ITEM_ID_PATTERN.test(itemId) || !title || !input?.component) {
        logger.warn("Action: plugins_settings_item_invalid", {
          pluginId: id,
          itemId,
          hasTitle: Boolean(title),
          hasComponent: Boolean(input?.component),
        });
        return () => {};
      }

      const key = entryKey(id, itemId);
      const existing = entries.get(key);
      if (!existing && countOf(id) >= PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN) {
        logger.warn("Action: plugins_settings_item_limit_exceeded", {
          pluginId: id,
          itemId,
          limit: PLUGIN_SETTINGS_ITEM_LIMIT_PER_PLUGIN,
        });
        return () => {};
      }

      seq += 1;
      const entry: Entry = {
        id: itemId,
        title,
        description: normalize(input.description) || undefined,
        keywords: Object.freeze(normalizeKeywords(input.keywords)),
        order: normalizeOrder(input.order),
        component: input.component as Component,
        pluginId: id,
        serverSocket: ownerSocket,
        seq,
      };
      entries.set(key, entry);

      return () => {
        // 仅移除本次注册写入的项：同 id 被后续注册替换后，旧取消函数不应误删新项。
        if (entries.get(key) === entry) entries.delete(key);
      };
    },

    unregister(pluginId: string): void {
      const id = normalize(pluginId);
      if (!id) return;
      for (const [key, entry] of entries) {
        if (entry.pluginId === id) entries.delete(key);
      }
    },

    list(): PluginSettingsContribution[] {
      const ordered = Array.from(entries.values()).sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        const byPlugin = a.pluginId.localeCompare(b.pluginId);
        if (byPlugin !== 0) return byPlugin;
        return a.seq - b.seq;
      });
      return ordered.map((entry) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
        keywords: entry.keywords,
        order: entry.order,
        component: entry.component,
        pluginId: entry.pluginId,
        serverSocket: entry.serverSocket,
      }));
    },

    clear(): void {
      entries.clear();
      seq = 0;
    },
  };
}
