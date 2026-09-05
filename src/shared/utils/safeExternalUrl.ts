/**
 * @fileoverview 安全外链工具：协议白名单校验 + 受控打开。
 *
 * 安全约束：URL 常来自服务端消息数据（可能被恶意构造），
 * 仅允许 http/https，拒绝 javascript:/vbscript:/file: 等任意 scheme，
 * 防止把服务端可控字符串直接赋给 <a href> 或 window.open 造成 XSS。
 */

/**
 * 校验字符串是否为可安全导航的 http(s) URL。
 *
 * @param raw - 待校验的 URL 字符串（可为 null/undefined）。
 * @returns 解析后的 URL 对象；不安全或非法时返回 null。
 */
export function parseSafeHttpUrl(raw: string | null | undefined): URL | null {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return null;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * 受控打开外部链接（仅 http/https；带 noopener,noreferrer）。
 *
 * @param raw - 待打开的 URL 字符串。
 * @returns 是否实际发起了打开（协议不安全时返回 false 且不执行）。
 */
export function openExternalUrl(raw: string | null | undefined): boolean {
    const parsed = parseSafeHttpUrl(raw);
    if (!parsed) return false;
    window.open(parsed.toString(), "_blank", "noopener,noreferrer");
    return true;
}
