# 客户端插件包结构与资源加载（草案）

范围：定义插件包的“发布物结构、安装后的本地目录结构、以及 app:// 资源加载约定”。不讨论服务端内部实现。

目标：
- 同一插件包在 PC 与移动端均可加载（Web/Vue 技术栈）。
- 插件资源通过本地 `app://`（或等价应用内静态资源协议）加载，不依赖在线远端加载。
- 支持按 `server_id` 隔离安装与缓存。

---

## 1. 发布物（Artifact）格式（P0）

确定格式：**单文件压缩包 `zip`**。

- 文件名建议：`{plugin_id}-{version}.zip`
- 完整性校验：下载端提供 `sha256`，客户端安装前必须校验

压缩包内为一个“根目录”（root），根目录必须包含：
- `plugin.json`：插件 manifest（见 `docs/design/plugin/PLUGIN-MANIFEST.md`）
- `index.js`：默认入口（也可由 `plugin.json.entry` 指定；推荐指向构建产物，例如 `dist/index.js`）
- `assets/`：静态资源目录（可选）
- `styles/`：样式目录（可选）

示例：
```
plugin.json
index.js
dist/
  index.js
assets/
  icon.png
  fonts/
styles/
  main.css
```

约束（P0，已确定：可直接执行）
- 插件包安装后必须可直接执行：宿主加载入口 ESM 后即可运行，不需要二次编译/转译/模板编译/样式预处理。
- 插件包不得包含需要宿主二次编译的源文件/产物，例如：
  - Vue SFC：`*.vue`
  - TypeScript/JSX：`*.ts`、`*.tsx`、`*.jsx`
  - 样式预处理：`*.scss`、`*.sass`、`*.less`、`*.styl`
  - 其他需要额外编译链路的文件类型（除非未来新增宿主支持并在文档中声明）

允许（P0）：
- 可执行 ESM：`*.js`/`*.mjs`
- 纯 CSS：`*.css`
- 静态资源：图片/字体等（由浏览器/运行时直接消费）
- Source map：`*.map`（可选，用于调试，不影响执行）

约束（P0）：
- 禁止压缩包内出现 `..` 目录穿越路径
- （可选）单个插件包解压后总大小上限（宿主可配置）

---

## 2. 安装后的本地目录结构（P0）

插件按“服务器身份”隔离存放。**确定使用服务端返回的固定 UUID 作为 `server_id`**（稳定、跨设备一致，且避免对 `server_socket` 做哈希带来的调试/迁移问题）。

约定：
- `server_id: string`：服务端返回的固定 UUID（推荐为标准 UUID 文本，例如 `550e8400-e29b-41d4-a716-446655440000`）。
- 客户端将其用于本地隔离键（目录名/缓存 key）。若服务端返回格式不满足文件名安全要求，客户端必须做规范化（例如仅保留 `[a-zA-Z0-9-]`）。

推荐路径（示例）：
```
<app_data>/plugins/
  <server_id>/
    <plugin_id>/
      <version>/
        plugin.json
        index.js
        assets/...
        styles/...
      current.json
```

其中：
- `<version>/`：版本目录（允许多版本并存，便于回滚）
- `current.json`：指向当前启用版本，例如 `{ "version": "1.2.0", "enabled": true }`

约束（P0）：
- 同一 `plugin_id` 在不同服务器可安装不同版本
- 同一服务器下所有频道共享插件（由 server_id 维度决定）

---

## 3. app:// 资源映射（P0）

宿主必须提供一个“插件静态资源根”，把本地插件目录映射到 `app://plugins/...`（或等价协议）。

URL 规范详见：`docs/design/client/APP-URL-SPEC.md`。

建议映射规则：
```
app://plugins/<server_id>/<plugin_id>/<version>/
```

入口模块 URL：
```
app://plugins/<server_id>/<plugin_id>/<version>/<entry>
```

其中 `<entry>` 默认为 `index.js`，或读取 `plugin.json.entry`。

---

## 4. 资源引用约定（P0）

### 4.1 ESM 内的相对路径 import（推荐）
插件在 `index.js` 内引用同包资源时必须使用**相对路径**：
- JS 模块：`import x from "./x.js"`
- CSS：`import "./styles/main.css"`
- 图片/字体：建议通过 URL 构造或相对路径引用（见 4.2）

原因：
- 相对路径在 `app://.../<version>/` 下可稳定解析
- 避免把宿主内部路径结构暴露给插件

### 4.2 静态资源 URL 获取（建议）
宿主应提供一个 `getAssetUrl(relativePath)`（或等价能力）给插件（无需 network 权限）：
- 输入：相对路径（例如 `assets/icon.png`）
- 输出：可用于 `<img src>` 的 `app://...` URL

若不提供该 API，插件也可以通过 `new URL("./assets/icon.png", import.meta.url).toString()` 自行构造。

---

## 5. 缓存与更新行为（P0）

### 5.1 版本化路径（必须）
所有加载路径必须包含 `<version>`，避免资源缓存污染。

### 5.2 更新与回滚（与安装策略一致）
- 更新：下载新版本 → 校验 sha256 → 解压到新 `<version>/` → 试加载/enable 成功后更新 `current.json`
- 回滚：只需把 `current.json.version` 指回旧版本

### 5.3 清理策略（P1）
- 可按“保留最近 N 个版本/最近 N 天未使用版本”清理

---

## 6. 待你确认的 3 个取舍

（已确认）
1) 发布物格式：zip  
2) 依赖打包：允许插件包内包含第三方依赖打包产物（例如 bundler 产物、vendor 文件等）  
3) 服务器隔离键：使用服务端返回的固定 UUID：`server_id`  

补充约束（P0）：
- 即使允许内置依赖，插件包也不得包含可执行原生二进制；仅允许 Web 资产（JS/CSS/图片/字体等）。
