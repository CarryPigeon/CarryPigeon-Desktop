# 插件资源引用实践（精简版）

> 目标：给插件作者最稳的资源引用写法，避免跨端差异。

## 1. 真源链接

- URL 规则：`docs/design/client/APP-URL-SPEC.md`
- 包结构：`docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`

## 2. 核心规则（P0）

- 资源引用优先使用相对路径或 `import.meta.url`。
- 不硬编码宿主内部路径。
- 不依赖远端资源 URL（网络访问应走宿主受控 API）。
- 插件发布物必须是可直接执行产物（不含 `.vue`/`.ts` 等源文件）。

## 3. 推荐写法

### 3.1 图片/静态资源

```ts
const iconUrl = new URL("../assets/icon.png", import.meta.url).toString();
```

### 3.2 CSS

```ts
import "../styles/main.css";
```

### 3.3 动态 import

```ts
const mod = await import("./heavy-module.js");
```

要求：路径必须在插件包内，禁止动态加载远端 `http(s)`。

## 4. 字体与样式注意点

- 字体建议放 `assets/fonts/`，在 CSS 中用相对路径引用。
- 插件 CSS 可影响宿主全局样式，建议插件中心给出风险提示。

## 5. 宿主辅助能力（可选）

宿主可提供 `getAssetUrl(relativePath)`。
插件可二选一：
- `new URL(rel, import.meta.url)`
- `getAssetUrl(rel)`
