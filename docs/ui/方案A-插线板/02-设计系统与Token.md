# 02｜设计系统与 Token（Patchbay 暗色主题）

版本：v1.0  
日期：2026-01-31

> 目标：提供“可直接落地”的 Token（CSS 变量）+ 组件密度规则。  
> 建议通过 `:root[data-theme="patchbay"] { ... }` 启用，避免破坏既有主题。

## 1. 字体（Typography）

策略：标题“窄 + 工业铭牌感”，正文“高可读 + 中文友好”，代码/ID“等宽”。

推荐栈（避免 Inter/Roboto/Arial 作为首选）：

```css
--cp-font-display: "Saira Semi Condensed", "DIN Alternate", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei UI", sans-serif;
--cp-font-body: "Sarasa UI SC", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei UI", sans-serif;
--cp-font-mono: "Iosevka", "JetBrains Mono", "Cascadia Mono", "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
```

字号/行高（桌面密度）：
- Body：13px / 1.45
- Meta：12px / 1.3
- Title：16–18px（面板标题），大标题 22–26px（登录页）

## 2. 颜色（Color）

### 2.1 背景与表面

```css
--cp-bg: #0b0f14;              /* 石墨底 */
--cp-bg-2: #0f1620;            /* 深蓝灰 */
--cp-surface: rgba(17, 24, 39, 0.62);
--cp-panel: rgba(17, 24, 39, 0.78);
--cp-panel-solid: #111827;
--cp-border: rgba(148, 163, 184, 0.18);
--cp-border-light: rgba(148, 163, 184, 0.12);
--cp-text: rgba(248, 250, 252, 0.92);
--cp-text-muted: rgba(226, 232, 240, 0.62);
--cp-text-light: rgba(226, 232, 240, 0.42);
```

### 2.2 状态色（非 domain）

```css
--cp-accent: #22c55e;          /* 连接/可用（绿） */
--cp-warn: #f59e0b;            /* 重连/注意（琥珀） */
--cp-danger: #ef4444;          /* 失败/阻止（红） */
--cp-info: #38bdf8;            /* 信息/提示（天蓝） */
```

### 2.3 Domain 线缆色（必须可扩展）

```css
--cp-domain-core: #2dd4bf;     /* Core:Text */
--cp-domain-math: #60a5fa;     /* Math:* */
--cp-domain-poetry: #f472b6;   /* Poetry:* */
--cp-domain-mc: #a78bfa;       /* MC:* */
--cp-domain-unknown: #94a3b8;  /* Unknown */
```

规则：
- domain 颜色只用于：左侧细条（2–3px）、徽章边框、进度高亮、微动效。
- 任何 domain 必须显示文字标签（避免纯靠颜色）。

## 3. 形状与阴影（Shape & Elevation）

```css
--cp-radius-sm: 10px;
--cp-radius: 14px;
--cp-radius-lg: 18px;
--cp-shadow-soft: 0 12px 30px rgba(0, 0, 0, 0.45);
--cp-shadow: 0 22px 70px rgba(0, 0, 0, 0.62);
--cp-ring: 0 0 0 3px rgba(56, 189, 248, 0.28);
```

## 4. 纹理与网格（Background Details）

- 背景网格：12px 间距，低对比（不抢内容）。
- “刻度线”：在 rail 侧边用 `repeating-linear-gradient` 做刻度，强化“仪器感”。
- 噪点：非常低的 alpha，避免 banding。

## 5. 动效（Motion）

```css
--cp-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
--cp-fast: 160ms;
--cp-slow: 360ms;
```

建议动效（克制但有记忆点）：
- Module 卡片 hover：轻微上浮 + 端口高亮（像通电）。
- Cable hover：细小“波形呼吸”动画（仅装饰，不影响可读性）。
- Required lock：轻微抖动 + 红色锁扣闪烁（仅在阻止登录时）。

## 6. TDesign 变量对齐（推荐）

```css
--td-brand-color: var(--cp-info);
--td-text-color-primary: var(--cp-text);
--td-text-color-secondary: var(--cp-text-muted);
--td-bg-color-container: var(--cp-panel);
--td-border-level-1-color: var(--cp-border);
--td-mask-active: rgba(0, 0, 0, 0.55);
--td-font-family: var(--cp-font-body);
```

