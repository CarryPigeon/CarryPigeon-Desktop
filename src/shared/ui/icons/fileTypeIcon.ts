/**
 * @fileoverview 文件类型图标映射（fileTypeIcon.ts）。
 * @description 依据 mime type 返回自绘图标注册表 key，供文件列表、文件预览与文件消息气泡复用，
 * 避免各处重复实现（历史上曾以 emoji 充当文件类型图标）。
 */

/**
 * 依据 mime type 选择文件类型图标 key。
 *
 * @param mimeType - 文件 mime type（可能缺失）。
 * @returns `LUCIDE_SPRITE` 中的图标 key。
 */
export function fileTypeIconName(mimeType?: string): string {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("pdf")) return "file";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("gz")) return "package";
  if (mime.includes("text/") || mime.includes("document")) return "file-text";
  return "paperclip";
}

/** 本映射可能返回的全部图标 key（供注册表完整性测试断言）。 */
export const FILE_TYPE_ICON_NAMES: readonly string[] = [
  "image",
  "video",
  "audio",
  "file",
  "package",
  "file-text",
  "paperclip",
];
