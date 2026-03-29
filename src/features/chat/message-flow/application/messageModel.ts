/**
 * @fileoverview 聊天消息模型映射与合并工具。
 * @description chat/message-flow｜application：消息模型映射与合并工具。
 */

import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatMessage, MessageDomain } from "@/features/chat/message-flow/contracts";

type MessageModelDeps = {
  resolveDomainPluginHint(serverSocket: string, domain: string): string;
};

function mapDomainColorVar(domain: string): MessageDomain["colorVar"] {
  const d = domain.trim();
  if (d.startsWith("Core:")) return "--cp-domain-core";
  if (!d) return "--cp-domain-unknown";

  let hash = 0;
  for (let i = 0; i < d.length; i += 1) hash = (hash * 31 + d.charCodeAt(i)) >>> 0;
  const lane = hash % 3;
  if (lane === 0) return "--cp-domain-ext-a";
  if (lane === 1) return "--cp-domain-ext-b";
  return "--cp-domain-ext-c";
}

export function createMessageMapper(deps: MessageModelDeps) {
  function mapWireMessage(serverSocket: string, m: ChatMessageRecord): ChatMessage {
    const mid = String(m.id ?? "").trim() || `msg_${Date.now()}`;
    const uid = String(m.userId ?? "").trim();
    const fromName = String(m.sender?.nickname ?? "").trim() || (uid ? `u:${uid.slice(-6)}` : "Unknown");
    const timeMs = Number(m.sentTime ?? 0) || Date.now();
    const domainLabel = String(m.domain ?? "").trim() || "Unknown:Domain";
    const pluginIdHint = deps.resolveDomainPluginHint(serverSocket, domainLabel) || "";
    const domain: MessageDomain = {
      id: domainLabel,
      label: domainLabel,
      colorVar: mapDomainColorVar(domainLabel),
      pluginIdHint: pluginIdHint || undefined,
      version: String(m.domainVersion ?? "").trim() || undefined,
    };

    const replyToId = String(m.replyToMessageId ?? "").trim() || undefined;

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

  return { mapWireMessage };
}

export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? -1 : 1;
  return a.id.localeCompare(b.id);
}

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
