/**
 * @fileoverview AppIcon 内置 SVG 路径表（lucide-sprite.ts）。
 * @description 仅收录 TDesign iconfont 缺失或不一致的图标；走 stroke-only 风格，
 * 复用 currentColor 与 cp-text 主题色，保持与 ScreenshotButton 等内联 SVG 视觉一致。
 */

export const LUCIDE_SPRITE: Readonly<Record<string, string>> = {
  smile: '<circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />',
  'sort-asc': '<path d="M11 5h10" /><path d="M11 9h7" /><path d="M11 13h4" /><path d="m3 17 3 3 3-3" /><path d="M6 18V4" />',
  'sort-desc': '<path d="M11 5h4" /><path d="M11 9h7" /><path d="M11 13h10" /><path d="m3 7 3-3 3 3" /><path d="M6 4v14" />',
  'arrow-left-key': '<path d="m17 2 4 4-4 4" /><path d="M3 11h18" /><path d="M21 6h-4a4 4 0 0 0-4 4v0" />',
  'arrow-right-key': '<path d="m7 2-4 4 4 4" /><path d="M21 11H3" /><path d="M3 6h4a4 4 0 0 1 4 4v0" />',
  hash: '<line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />',
  'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />',
  pin: '<line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />',
  'circle-dot': '<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" />',
  hand: '<path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />',
  'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />',
};
