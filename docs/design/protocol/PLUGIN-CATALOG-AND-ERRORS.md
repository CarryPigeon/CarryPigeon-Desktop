# 协议：插件目录与错误响应（草案）

范围：定义客户端依赖的“插件目录发现 + required gate + 错误响应”最小约定。服务端内部如何实现不在本文讨论。

## 1. 目标
- 客户端能在登录前获取插件目录，并判断 required 插件是否满足。
- required 未满足时：允许安装向导，但阻止登录（见 ADR-0001）。
- 客户端在遇到未知 domain 时，能根据目录提示“应安装哪个插件”。

## 2. 插件目录（Server Catalog）

### 2.1 获取目录
建议路由（可按实现调整）：
- `GET /core/plugin/catalog/get`（HTTP）或 TCP 路由等价形式

响应最小结构（示例）：
```json
{
  "plugins": [
    {
      "plugin_id": "math-formula",
      "name": "Math Formula",
      "version": "1.2.0",
      "min_host_version": "0.1.0",
      "permissions": ["network"],
      "required": false,
      "provides_domains": [
        { "domain": "Math:Formula", "domain_version": "1.0.0" }
      ],
      "download": { "url": "https://...", "sha256": "..." }
    }
  ],
  "required_plugins": ["mc-bind"]
}
```

约定：
- `server_id` 不由本接口返回；客户端应从“服务器信息接口”（见 `docs/design/protocol/PROTOCOL-OVERVIEW.md`）获取 `server_id`，用于本地插件安装与缓存隔离（见 `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`）。
- `required_plugins` 为服务器级 required 列表（频道不约束插件）。
- `provides_domains` 用于客户端做 domain -> plugin_id 的提示映射。

## 3. 仓库目录（Repo Catalog）
客户端可配置多个仓库源（URL）。仓库返回结构与 Server Catalog 的 `plugins[]` 兼容即可。

## 4. required gate：错误响应（客户端可识别）

### 4.1 触发条件
当 `required_plugins` 未满足时，服务端必须拒绝登录相关接口（register/login/token-login）。

### 4.2 最小错误格式（建议）
不强制具体 code，但必须可被客户端稳定识别：
```json
{
  "code": 320,
  "data": {
    "reason": "required_plugin_missing",
    "missing_plugins": ["mc-bind"]
  }
}
```

客户端行为：
- 进入安装向导（目标 server_socket）
- 安装/启用完成后允许重试登录

## 5. 未知 domain 的降级提示
当客户端收到消息 `domain=X` 但本地未安装对应 renderer：
- 优先展示 message `preview`（若存在）。
- 同时查目录 `provides_domains` 映射，若能定位 plugin_id，则提示“一键安装插件 plugin_id”。
