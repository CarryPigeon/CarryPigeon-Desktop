# 前端调试与 Mock 切换

本项目支持在不接入服务端时使用 Mock 数据，并可随时切换到真实后端。

## 一、启用 Mock

1. 新建或修改 ` .env.local `（或 ` .env.development `）。
2. 设置以下环境变量：

```env
VITE_USE_MOCK_API=true
VITE_MOCK_LATENCY_MS=120
VITE_MOCK_SERVER_SOCKET=mock://handshake
```

说明：

- `VITE_USE_MOCK_API=true`：启用 Mock 服务（频道、消息、成员、登录等都会走本地 Mock）。
- `VITE_MOCK_LATENCY_MS`：模拟网络延迟（毫秒）。
- `VITE_MOCK_SERVER_SOCKET`：模拟的 server socket。

Mock 行为特性：

- 登录页会自动填入 `server socket` 与 `ECC 公钥`（避免手动输入）。
- 任意邮箱 + 验证码可登录（Mock 不校验）。
- 频道/消息/成员为内存态数据（刷新后会重置）。

## 二、切换到真实后端

1. 将 `VITE_USE_MOCK_API` 设为 `false` 或直接删除该环境变量。
2. 登录页手动输入服务端提供的：
   - `server socket`
   - `server ECC 公钥`
3. 使用邮箱验证码登录，token 来自登录接口返回值。

## 三、推荐配置文件

你可以在仓库根目录使用以下文件组织配置：

- ` .env.local `：本机私有配置，不提交
- ` .env.development `：团队统一的开发配置（可提交）
- ` .env.production `：生产配置

