/**
 * @fileoverview 聊天消息模型映射与合并工具。
 * @description chat｜展示层状态（store）：liveChatMessageModel。
 * 将 wire DTO（HTTP/WS 返回）转换为 UI 可渲染的消息模型，并提供：
 * - domain → UI 颜色 token 映射
 * - domain → pluginIdHint 推断（用于 UnknownDomain 降级卡片）
 * - 消息去重合并（按 id）+ 稳定排序
 *
 * 该模块刻意保持“纯工具”风格：不维护状态，仅依赖入参与只读 store。
 */

import { useDomainCatalogStore, usePluginCatalogStore } from "@/features/plugins/api";
import type { MessageDto } from "@/features/chat/domain/types/chatWireDtos";
import type { ChatMessage, MessageDomain } from "../chatStoreTypes";

/**
 * 将 domain 字符串映射为 Patchbay 颜色 token（CSS 变量）。
 *
 * @param domain - domain 标签（例如 `Core:Text`, `Ext:Custom`）。
 * @returns CSS 变量名。
 */
function mapDomainColorVar(domain: string): MessageDomain["colorVar"] {
  const d = domain.trim();
  if (d.startsWith("Core:")) return "--cp-domain-core";
  if (!d) return "--cp-domain-unknown";

  // 扩展 domain 的通用映射：稳定但不绑定具体业务场景。
  let hash = 0;
  for (let i = 0; i < d.length; i += 1) hash = (hash * 31 + d.charCodeAt(i)) >>> 0;
  const lane = hash % 3;
  if (lane === 0) return "--cp-domain-ext-a";
  if (lane === 1) return "--cp-domain-ext-b";
  return "--cp-domain-ext-c";
}

/**
 * 从当前 server 的 catalog/domain-catalog 中推断某个 domain 对应的 pluginId 提示。
 *
 * 用途：UnknownDomain 降级卡片可直接跳转到插件中心并聚焦插件。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @param domain - domain 标签。
 * @returns pluginId 提示；不存在则返回空字符串。
 */
function findPluginHintForDomain(serverSocket: string, domain: string): string {
  const catalog = usePluginCatalogStore(serverSocket).catalog.value;
  const domainCatalog = useDomainCatalogStore(serverSocket).byDomain.value;
  const d = domain.trim();
  if (!d) return "";
  for (const p of catalog) {
    for (const it of p.providesDomains) {
      if (it.label === d || it.id === d) return p.pluginId;
    }
  }
  const item = domainCatalog[d] ?? null;
  if (!item) return "";
  for (const p of item.providers ?? []) {
    if (p.type === "plugin" && String(p.pluginId ?? "").trim()) return String(p.pluginId).trim();
  }
  return "";
}

/**
 * 将 API Message DTO 映射为 UI 渲染模型。
 *
 * @param serverSocket - 服务器 Socket 地址（用于 domain → plugin hint 推断）。
 * @param m - API message DTO。
 * @returns UI message model。
 */
export function mapWireMessage(serverSocket: string, m: MessageDto): ChatMessage {
  const mid = String(m.mid ?? "").trim() || `msg_${Date.now()}`;
  const uid = String(m.uid ?? "").trim();
  const fromName = String(m.sender?.nickname ?? "").trim() || (uid ? `u:${uid.slice(-6)}` : "Unknown");
  const timeMs = Number(m.send_time ?? 0) || Date.now();
  const domainLabel = String(m.domain ?? "").trim() || "Unknown:Domain";
  const pluginIdHint = findPluginHintForDomain(serverSocket, domainLabel) || "";
  const domain: MessageDomain = {
    id: domainLabel,
    label: domainLabel,
    colorVar: mapDomainColorVar(domainLabel),
    pluginIdHint: pluginIdHint || undefined,
    version: String(m.domain_version ?? "").trim() || undefined,
  };

  const replyToId = String(m.reply_to_mid ?? "").trim() || undefined;

  /**
   * 尝试从未知 data 对象读取 `text` 字段（Core:Text 的最小落地）。
   *
   * @param data - 未知 message payload。
   * @returns 存在时返回 text；否则返回 `null`。
   */
  function tryReadText(data: unknown): string | null {
    if (!data || typeof data !== "object") return null;
    const maybe = data as { text?: unknown };
    return typeof maybe.text === "string" ? maybe.text : null;
  }

  if (domainLabel === "Core:Text") {
    const text = tryReadText(m.data) ?? String(m.preview ?? "");
    return { id: mid, kind: "core_text", from: { id: uid, name: fromName }, timeMs, domain, text, replyToId };
  }

  const preview = String(m.preview ?? "").trim() || `UNPATCHED SIGNAL · ${domainLabel}${domain.version ? `@${domain.version}` : ""}`;
  return { id: mid, kind: "domain_message", from: { id: uid, name: fromName }, timeMs, domain, preview, data: m.data, replyToId };
}

/**
 * 消息排序比较器（稳定）。
 *
 * 说明：
 * - API 侧通常以 `mid`（Snowflake）或 `send_time + mid` 作为稳定排序键。
 * - 客户端这里以 `timeMs` 为主键，`id` 为兜底键，保证稳定排序。
 *
 * @param a - 消息 A。
 * @param b - 消息 B。
 * @returns 比较结果。
 */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? -1 : 1;
  return a.id.localeCompare(b.id);
}

/**
 * 按 `id` 合并消息（去重），并返回稳定排序后的列表。
 *
 * @param existing - 既有列表。
 * @param incoming - 新增列表。
 * @returns 合并后的去重排序列表。
 */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const m of existing) {
    if (!m?.id) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  for (const m of incoming) {
    if (!m?.id) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  out.sort(compareMessages);
  return out;
}
