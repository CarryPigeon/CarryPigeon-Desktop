/**
 * @fileoverview iconRegistry.test.ts
 * @description shared/ui/icons｜自绘图标注册表完整性兜底：
 * 1) 模板中出现的图标名必须存在于 `LUCIDE_SPRITE`（否则 AppIcon 会渲染 `?`）；
 * 2) 首方 UI 不再使用 TDesign iconfont（`<t-icon>`）；
 * 3) 使用 `<AppIcon>` 的 SFC 必须显式导入组件；
 * 4) TDesign 内置图标覆盖表覆盖全部必需图标键。
 *
 * 实现说明：通过 Vite `import.meta.glob(..., { query: "?raw" })` 直接读取源码文本，
 * 避免在浏览器目标代码中引入 Node 类型（`@types/node` 会污染全局 setTimeout 签名）。
 */

import { describe, expect, it } from "vitest";
import { LUCIDE_SPRITE } from "./lucide-sprite";
import { FILE_TYPE_ICON_NAMES } from "./fileTypeIcon";
import { TD_ICON_OVERRIDE_KEYS } from "./tdIconOverrides";

const RAW_SOURCES = {
  ...import.meta.glob("/src/**/*.vue", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob("/plugins/*/src/**/*.vue", { query: "?raw", import: "default", eager: true }),
} as Record<string, string>;

/** 仓库根相对路径列表（如 `src/shared/ui/AppIcon.vue`）。 */
const vueFiles = Object.keys(RAW_SOURCES).map((absolute) => absolute.replace(/^\//u, ""));

/** AppIcon.vue 的文档注释里出现 `<t-icon>` 字样，属说明文本而非用法。 */
const T_ICON_DOC_ALLOWLIST = new Set(["src/shared/ui/AppIcon.vue"]);
/** 标注工具表的图标名（数据驱动，不在模板字面量中）。 */
const ANNOTATION_TOOLBAR = "src/features/screenshot/presentation/components/tools/AnnotationToolbar.vue";
/** TDesign 组件内置图标中必须被自绘覆盖的键（见 tdIconOverrides.ts）。 */
const REQUIRED_TD_ICON_KEYS = [
  "CloseIcon",
  "CloseCircleFilledIcon",
  "CheckCircleFilledIcon",
  "ErrorCircleFilledIcon",
  "InfoCircleFilledIcon",
  "HelpCircleFilledIcon",
  "BrowseIcon",
  "BrowseOffIcon",
  "CalendarIcon",
  "ChevronLeftIcon",
  "ChevronRightIcon",
  "ChevronUpIcon",
  "ChevronDownIcon",
  "RoundIcon",
];

/**
 * 读取源码文本。
 *
 * @param rel - 仓库根相对路径。
 * @returns 文件文本。
 */
function readVue(rel: string): string {
  return RAW_SOURCES[`/${rel}`] ?? "";
}

describe("自绘图标注册表", () => {
  it("扫描范围覆盖 src 与 plugins 的 .vue 源码", () => {
    expect(vueFiles.length).toBeGreaterThan(50);
    expect(vueFiles).toContain("src/shared/ui/AppIcon.vue");
    expect(vueFiles).toContain(ANNOTATION_TOOLBAR);
  });

  it("模板中字面量图标名全部存在于注册表", () => {
    const missing: string[] = [];
    for (const rel of vueFiles) {
      const names = new Set<string>();
      for (const tag of readVue(rel).matchAll(/<AppIcon\b[^>]*>/gu)) {
        const staticName = /\sname="([a-z0-9-]+)"/u.exec(tag[0]);
        if (staticName) names.add(staticName[1]);
        const dynamicName = /:name="([^"]*)"/u.exec(tag[0]);
        if (dynamicName) {
          // 先剔除比较表达式中的字面量（如 sortOrder === 'asc' 中的 'asc'），只保留作为图标名的字面量。
          const expression = dynamicName[1].replace(/[!=]==\s*'[^']*'/gu, "");
          for (const literal of expression.matchAll(/'([a-z0-9-]+)'/gu)) names.add(literal[1]);
        }
      }
      for (const name of names) {
        if (!(name in LUCIDE_SPRITE)) missing.push(`${rel}: ${name}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("数据驱动的图标名（标注工具、文件类型）全部存在于注册表", () => {
    const toolIcons = [...readVue(ANNOTATION_TOOLBAR).matchAll(/icon:\s*"([a-z0-9-]+)"/gu)].map((m) => m[1]);
    expect(toolIcons.length).toBeGreaterThan(0);

    const missing = [...toolIcons, ...FILE_TYPE_ICON_NAMES].filter((name) => !(name in LUCIDE_SPRITE));

    expect(missing).toEqual([]);
  });

  it("首方模板不再使用 TDesign iconfont", () => {
    const offenders = vueFiles.filter(
      (rel) => !T_ICON_DOC_ALLOWLIST.has(rel) && readVue(rel).includes("<t-icon"),
    );

    expect(offenders).toEqual([]);
  });

  it("使用 AppIcon 的 SFC 均已显式导入组件", () => {
    const offenders = vueFiles
      .filter((rel) => rel !== "src/shared/ui/AppIcon.vue")
      .filter((rel) => {
        const text = readVue(rel);
        return text.includes("<AppIcon") && !/from\s+["']@\/shared\/ui\/AppIcon\.vue["']/u.test(text);
      });

    expect(offenders).toEqual([]);
  });

  it("注册表 key 统一 kebab-case，且不包含空条目", () => {
    const badKeys = Object.keys(LUCIDE_SPRITE).filter((key) => !/^[a-z0-9]+(-[a-z0-9]+)*$/u.test(key));
    const emptyEntries = Object.entries(LUCIDE_SPRITE)
      .filter(([, inner]) => inner.trim().length === 0)
      .map(([key]) => key);

    expect(badKeys).toEqual([]);
    expect(emptyEntries).toEqual([]);
  });

  it("TDesign 内置图标覆盖表覆盖全部必需键", () => {
    const missing = REQUIRED_TD_ICON_KEYS.filter((key) => !TD_ICON_OVERRIDE_KEYS.includes(key));

    expect(missing).toEqual([]);
  });
});
