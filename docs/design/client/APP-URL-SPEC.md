# 客户端 `app://` URL 规范（`app://plugins/...`）（草案）

范围：定义客户端对“应用内静态资源协议”的 URL 结构与解析规则，使插件在 PC/移动端都能稳定加载入口 ESM 与资源文件。

本规范不讨论插件包安全策略与服务端实现细节；仅描述客户端侧必须一致的 URL 语义。

---

## 1. 基本约定

- Scheme：`app://`
- 插件资源根：`app://plugins/`
- URL 作为“资源定位符”，应与本地安装目录一一对应（见 `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`）。

标准形态：
```
app://plugins/<server_id>/<plugin_id>/<version>/<path>
```

其中：
- `<server_id>`：服务端返回的固定 UUID（见 `docs/design/PRD.md`、`docs/design/protocol/PROTOCOL-OVERVIEW.md`）
- `<plugin_id>`：插件唯一标识（来自 manifest）
- `<version>`：插件版本（SemVer 字符串）
- `<path>`：插件包内相对路径（例如 `index.js`、`assets/icon.png`）

---

## 2. 分段（Segment）规范化

### 2.1 `server_id`
- 推荐为标准 UUID 文本：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- 规范化：客户端在 URL 中使用 **小写** `server_id`（若服务端返回为大写，客户端应转小写）。

### 2.2 `plugin_id`
- 推荐字符集：`[a-z0-9._-]`，推荐使用小写 kebab-case（例如 `math-formula`）。
- 若实际 `plugin_id` 含有其他字符，客户端必须使用 URL percent-encoding 进行编码后再拼接到 URL 段中。

### 2.3 `version`
- 采用插件 manifest 的 `version`（SemVer 字符串）。
- 建议在 URL 中保持原样；若包含非 URL 安全字符，需 percent-encoding。

---

## 3. `<path>` 规则

### 3.1 相对路径
`<path>` 必须是相对路径：
- 不得以 `/` 开头
- 不得包含协议前缀（如 `http:`、`app:`）

### 3.2 路径分隔符
- 插件包内路径分隔符统一使用 `/`（即使底层文件系统为 Windows）

### 3.4 后缀与语义（补充）
- `*.js`：ESM 模块（入口或依赖）
- `*.css`：样式
（约定）插件包不包含 `*.vue`/`*.ts` 等编译前源文件；宿主不提供运行时编译。

### 3.3 查询参数与 hash
默认不使用 query/hash：
- 入口模块与资源 URL 不应携带 `?` 或 `#`
- 若未来需要 cache-busting，应通过 `<version>` 变化实现（版本化路径）

---

## 4. 入口模块 URL 解析

入口模块 URL 由：
```
app://plugins/<server_id>/<plugin_id>/<version>/<entry>
```

其中 `<entry>`：
- 默认：`index.js`
- 若 manifest 指定 `entry`：使用 manifest 的相对路径值（例如 `dist/index.js`）

解析规则：
- `<entry>` 被视为插件包内的相对路径（遵循第 3 章规则）

---

## 5. 资源 URL 生成（给插件作者的确定性写法）

### 5.1 推荐：基于 `import.meta.url` 构造
插件内部引用同包资源推荐使用：
- `new URL("./assets/icon.png", import.meta.url).toString()`

该写法在入口模块从 `app://plugins/.../<version>/...` 加载时，应解析到同一 `<server_id>/<plugin_id>/<version>` 根下。

### 5.2 可选：宿主 API `getAssetUrl(relativePath)`
宿主可提供 `getAssetUrl("assets/icon.png")`，返回对应 `app://...` URL（见 `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`）。

---

## 6. 版本化路径与缓存语义

- URL 必须包含 `<version>` 段，作为缓存隔离边界。
- 插件更新后使用新 `<version>` URL 加载，避免旧资源缓存污染。
- 回滚通过切换 `current.json` 指向旧 `<version>`，并加载对应旧 URL。

---

## 7. 待你确认的 2 个细节（用于最终定稿）

（已确认）
1) `app://plugins/` 前缀固定为 `plugins`。
2) 允许 `<path>` 中出现子目录（例如 `dist/`），只要满足相对路径规则（第 3 章）。
