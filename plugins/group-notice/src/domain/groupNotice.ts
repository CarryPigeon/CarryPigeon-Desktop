/**
 * @fileoverview 群通知 domain 纯函数：响应解析、条目归一化与未读 diff。
 * @description 不依赖 Vue / Tauri / 浏览器 API，可独立单测。
 */

/** 通知级别（宿主契约固定为三档） */
export type GroupNoticeLevel = "info" | "warning" | "critical";

/** 归一化后的群通知条目 */
export type GroupNotice = {
  noticeId: string;
  title: string;
  body: string;
  level: GroupNoticeLevel;
  issuedAt: number;
};

/** 通知列表响应的解析结果 */
export type GroupNoticeParseResult =
  | { ok: true; notices: GroupNotice[] }
  | { ok: false; error: string };

const KNOWN_LEVELS: readonly GroupNoticeLevel[] = ["info", "warning", "critical"];

/**
 * 归一化单条通知：level 未知时兜底为 "info"，issued_at 强制数字化（非法时为 0）。
 *
 * @param raw - 原始通知对象（来自响应体 notices 数组元素）。
 * @returns 归一化通知；缺少 notice_id 时返回 null（无法唯一标识，直接丢弃）。
 */
export function normalizeGroupNotice(raw: unknown): GroupNotice | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const noticeId = String(r.notice_id ?? "").trim();
  if (!noticeId) return null;
  const level = String(r.level ?? "").trim() as GroupNoticeLevel;
  const issuedAtRaw = r.issued_at;
  const issuedAt =
    typeof issuedAtRaw === "number"
      ? issuedAtRaw
      : Number(String(issuedAtRaw ?? "").trim() || Number.NaN);
  return {
    noticeId,
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    level: KNOWN_LEVELS.includes(level) ? level : "info",
    issuedAt: Number.isFinite(issuedAt) ? issuedAt : 0,
  };
}

/**
 * 解析 `GET /api/group/notices` 响应体 bodyText（容错）。
 *
 * 规则：
 * - bodyText 必须是合法 JSON 对象且包含 notices 数组，否则返回结构化错误；
 * - 每个条目经 normalizeGroupNotice 归一化，无法归一化的条目跳过。
 *
 * @param bodyText - 响应体文本。
 * @returns 解析结果（成功携带通知列表，失败携带错误说明）。
 */
export function parseGroupNoticesResponse(bodyText: string): GroupNoticeParseResult {
  const text = String(bodyText ?? "").trim();
  if (!text) {
    return { ok: false, error: "empty response body" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid JSON response" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "response body is not an object" };
  }
  const rawList = (parsed as Record<string, unknown>).notices;
  if (!Array.isArray(rawList)) {
    return { ok: false, error: "missing notices array" };
  }
  const notices: GroupNotice[] = [];
  for (const item of rawList) {
    const normalized = normalizeGroupNotice(item);
    if (normalized) notices.push(normalized);
  }
  return { ok: true, notices };
}

/**
 * 计算新（未读）通知：相对已读游标集合做 diff。
 *
 * @param notices - 归一化后的通知列表。
 * @param readIds - 已读 notice id 集合。
 * @returns 未读通知列表（保持原有顺序）。
 */
export function diffNewNotices(notices: readonly GroupNotice[], readIds: ReadonlySet<string>): GroupNotice[] {
  return notices.filter((n) => !readIds.has(n.noticeId));
}
