# 02｜设计系统与 Token（可直接落地）

> 说明：该方案已废弃，现行方案为 `docs/ui/方案A-插线板/文档索引.md`。

版本：v1.1  
日期：2026-01-31

> 本项目以 CSS 变量为单一真相（Single Source of Truth）。主入口在 `src/App.vue` 的 `:root`。

## 1. 字体（Typography）

目标：中文可读性优先 + 标题有“印刷感”。

推荐（已在 `src/App.vue` 使用）：

```css
--cp-font-display: "Smiley Sans", "LXGW WenKai", "Alibaba PuHuiTi 3.0", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei UI", sans-serif;
--cp-font-body: "HarmonyOS Sans SC", "Alibaba PuHuiTi 2.0", "PingFang SC", "Microsoft YaHei UI", "Segoe UI", sans-serif;
--cp-font-mono: "Iosevka", "JetBrains Mono", "Cascadia Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
```

规范：
- 标题（h1~h4）：使用 display 栈 + 轻微负字距。
- 正文/表单：使用 body 栈，字号 12–14 为主（桌面客户端更密集）。
- 代码/ID：使用 mono 栈，避免等宽混用正文。

## 2. 颜色（Color）

概念：**ink on warm paper**，用色克制，但关键路径必须高辨识。

核心色（已存在）：

```css
--cp-bg: #f6f1e7;
--cp-bg-2: #e9f0ee;
--cp-text: #14201d;
--cp-text-muted: rgba(20, 32, 29, 0.62);
--cp-accent: #0f766e;         /* 主操作色 */
--cp-accent-2: #c2410c;       /* 强调/警示色（非错误） */
--cp-danger: #b42318;         /* 错误 */
```

新增建议（用于状态一致性，文档级约定）：

```css
--cp-success: #11734b;
--cp-success-soft: rgba(17, 115, 75, 0.14);
--cp-warn: #b45309;
--cp-warn-soft: rgba(180, 83, 9, 0.14);
--cp-info: #0369a1;
--cp-info-soft: rgba(3, 105, 161, 0.12);
```

## 3. 圆角与阴影（Shape & Elevation）

```css
--cp-radius-sm: 10px;
--cp-radius: 14px;
--cp-radius-lg: 18px;
--cp-shadow: 0 26px 70px rgba(20, 32, 29, 0.16);
--cp-shadow-soft: 0 10px 26px rgba(20, 32, 29, 0.12);
```

规范：
- 大容器（rail/pane/card）：`--cp-radius-lg`。
- 输入/按钮：`--cp-radius` 或 999（胶囊）。
- 阴影：主窗口用 soft，Modal/Info Window 可用 shadow（更“浮起”）。

## 4. 动效（Motion）

```css
--cp-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
--cp-fast: 160ms;
--cp-slow: 320ms;
```

规则：
- Hover：只做轻微上浮/亮度变化（不跳跃、不抖动）。
- Page load：一次性、成组的“淡入上移”比到处小动画更高级。
- `prefers-reduced-motion`：必须尊重（`src/App.vue` 已处理）。

## 4. 间距与密度（Spacing）

桌面聊天客户端建议密度偏紧，但要保持“呼吸感”：

- 基础间距单位：4px
- 常用间距：8 / 12 / 14 / 16 / 18 / 22 / 28
- 容器内边距（pane/card）：12–18
- 列表项高度：44（含 avatar）/ 36（紧凑）

## 5. 布局 Token（Layout）

（与现有主界面一致）

```css
--server-rail-width: 68px;
--channel-list-width: 280px;        /* 可拖拽调整（现有实现） */
--participants-list-width: 260px;
```

建议新增（便于统一输入框高度）：

```css
--cp-topbar-height: 54px;
--cp-chat-input-height: 136px; /* TextArea 内实际用 height 驱动 */
```

## 6. TDesign Token 对齐

原则：尽量用全局 `--td-*` 覆盖让组件“自动跟主题走”，避免每个组件手动覆写。

现状：`src/App.vue` 已做一组 best-effort 覆盖（brand/text/bg/border/radius/font）。

补充建议：
- 尽量把 TDesign 的容器背景统一指向 `--cp-panel` / `--cp-field-bg`。
- 危险操作（删除/卸载）：使用 `--cp-danger` + `--cp-danger-soft`，并在按钮文案中强调后果（PRD 10）。

## 7. 图标与层级（Icons & Layering）

图标风格：
- 线性描边为主，`stroke-width: 1.5`，`stroke-linecap: round`（见主界面空状态 icon 的既有风格）。
- 禁止过粗/填充式图标混入同一层级（保持“印刷线稿感”）。

层级建议（避免互相遮挡）：
- Base content：`z-index: 0`
- Popover / ContextMenu：`z-index: 10000`（靠近输入与列表的交互层）
- Modal / Fullscreen overlay：`z-index: 20000`（现有代码已使用）
