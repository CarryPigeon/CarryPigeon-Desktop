/**
 * @fileoverview 置顶频道顺序编辑纯逻辑。
 * @description chat/channel-pins｜domain：不依赖 Vue/Tauri，供置顶频道编辑弹窗组织草稿顺序，
 * 并与 Rust `channel_pins_set_order` 的归一化语义保持一致。
 */

/**
 * 归一化置顶频道 ID 列表：去除首尾空白、丢弃空串、按首次出现去重。
 */
export function normalizePinOrder(ids: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

/**
 * 追加置顶（新置顶项排在末尾）；已存在或 id 无效时返回归一化后的原顺序。
 */
export function addPin(ids: readonly string[], channelId: string): string[] {
  const normalized = normalizePinOrder(ids);
  const id = channelId.trim();
  if (!id || normalized.includes(id)) return normalized;
  return [...normalized, id];
}

/**
 * 取消置顶。
 */
export function removePin(ids: readonly string[], channelId: string): string[] {
  const id = channelId.trim();
  return normalizePinOrder(ids).filter((existing) => existing !== id);
}

/**
 * 相邻移动：`delta` 为 -1 上移 / 1 下移，越界或 id 不存在时保持原顺序。
 */
export function movePin(ids: readonly string[], channelId: string, delta: number): string[] {
  const normalized = normalizePinOrder(ids);
  const from = normalized.indexOf(channelId.trim());
  if (from < 0) return normalized;
  return reorderPin(normalized, from, from + delta);
}

/**
 * 重排：把 `fromIndex` 项移动到 `toIndex`，索引越界时钳制或保持原顺序。
 */
export function reorderPin(ids: readonly string[], fromIndex: number, toIndex: number): string[] {
  const normalized = normalizePinOrder(ids);
  if (normalized.length < 2) return normalized;
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return normalized;
  if (fromIndex < 0 || fromIndex >= normalized.length) return normalized;

  const target = Math.min(Math.max(toIndex, 0), normalized.length - 1);
  if (target === fromIndex) return normalized;

  const next = [...normalized];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(target, 0, moved);
  return next;
}
