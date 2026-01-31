# 插件资源引用实践（Vue / app://plugins）（草案）

范围：给插件作者的写法约定与最佳实践，确保在 PC/移动端（Web/Vue）下都能正确加载 `app://plugins/...` 资源。

依赖前置：
- URL 规则：`design/client/APP-URL-SPEC.md`
- 包结构：`design/client/PLUGIN-PACKAGE-STRUCTURE.md`

---

## 1. 总原则（P0）

1) 插件内资源引用优先使用**相对路径**或 `import.meta.url` 推导，不要硬编码宿主路径。
2) 插件资源必须位于本插件包内（`assets/`、`styles/` 或构建输出目录如 `dist/`）。
3) 插件不要依赖运行时远端 URL（除非走宿主受控 `network` API）。

---

## 2. 图片资源（推荐写法）

### 2.1 在组件中使用 URL（推荐）
```ts
const iconUrl = new URL("../assets/icon.png", import.meta.url).toString();
```

模板：
```vue
<img :src="iconUrl" alt="icon" />
```

原因：
- `import.meta.url` 指向 `app://plugins/<server_id>/<plugin_id>/<version>/...`，能稳定推导到同版本目录。

### 2.2 直接相对路径（不推荐）
在 Vue 模板中写 `src="../assets/icon.png"` 可能受构建器/运行时解析差异影响，不建议作为跨端最稳写法。

补充：
- 推荐统一用 `:src="new URL(..., import.meta.url).toString()"` 这类显式写法，避免跨端差异。

---

## 3. CSS（推荐写法）

### 3.1 ESM 中引入 CSS（推荐）
在插件入口或模块中：
```ts
import "../styles/main.css";
```

说明：
- 宿主加载入口模块时，CSS 也会以 `app://plugins/...` 路径加载。

### 3.2 组件内 `<style>`（允许）
单文件组件的 `<style>` 在插件构建后通常会被打包进产物；若你们以“已构建产物”发布，则可使用。

---

## 4. 字体（Fonts）

推荐放在 `assets/fonts/` 下，并在 CSS 中用相对路径引用：
```css
@font-face {
  font-family: "MyFont";
  src: url("../assets/fonts/myfont.woff2") format("woff2");
}
```

注意：
- 相对路径以“当前 CSS 文件所在路径”为基准。
- 确保构建产物保持相对路径可解析（建议不要在构建时把路径改写为绝对 URL）。

---

## 5. 动态 import（按需加载）

允许使用动态 import 分拆体积：
```ts
const mod = await import("./heavy-module.js");
```

要求：
- 动态 import 的相对路径必须在插件包内可解析。
- 不要动态 import 远端 http(s) URL。

---

## 6. 构建产物（已确定）

插件包不得包含编译前源文件（例如 `.vue`、`.ts`）。插件必须发布构建产物（ESM + 静态资源），并保证“安装后可直接执行”（宿主不做二次编译）。

推荐结构：
- `dist/index.js` + `dist/assets/...`
- `plugin.json.entry` 指向 `dist/index.js`

---

## 7. 宿主辅助能力（可选）

宿主可提供：
- `getAssetUrl(relativePath)`：返回 `app://plugins/...` URL

插件作者可二选一：
- 使用 `new URL(rel, import.meta.url)`（不依赖宿主 API）
- 使用 `getAssetUrl(rel)`（更语义化，但依赖宿主注入）

---

## 8. 待你确认的 2 个约束（影响插件生态的一致性）

（已确认）
1) 插件包不包含编译前源文件（例如 `.vue`、`.ts`）。  
2) 插件 CSS 允许影响宿主全局样式。  

补充说明：
- 允许全局 CSS 会提升“风格冲突/覆盖宿主样式”的风险；插件中心应展示“本插件会影响全局样式”的提示（可作为 P1 体验优化）。
