# Rust Feature Ports-Adapter 检查清单

本文档用于 `src-tauri/src/features/*` 的结构审核，补充 `Feature深层设计规范.md` 中的 Rust 侧约束。

目标结构：

```text
commands -> usecases -> domain/ports <- data adapters
```

## 1. 目录层次

推荐：

```text
src-tauri/src/features/<feature>/
  data/
  di/
  domain/
    ports/
    types.rs
  usecases/
```

要求：

- `domain` 只表达业务类型与端口契约。
- `data` 只实现 `domain/ports`。
- `usecases` 只依赖 `domain/ports` 与 `domain/types`。
- `di` / `commands` 负责装配 adapter 与 usecase。

## 2. import 检查

必须满足：

- `usecases/*` 不直接 `use crate::features::<feature>::data::*`
- `domain/*` 不依赖 `tauri`、IO、HTTP、数据库实现细节。
- `commands` 可依赖 `usecases` 与 `data`，但不应承载业务规则决策树。

发现以下情况应直接整改：

- `usecases` 直接 new/构造 data adapter
- `domain` 中出现网络请求、文件 IO、数据库调用
- `commands` 跳过 usecase 直接串接多个 data adapter 完成业务流程

## 3. 端口设计

要求：

- 每个跨边界依赖都先抽象为 `domain/ports/*`
- 端口名表达业务语义，不表达技术实现

推荐：

- `ConfigStorePort`
- `PluginStorePort`
- `TcpBackendPort`

避免：

- `HttpClientPort`
- `SqlitePort`
- `JsonFilePort`

说明：

- 若某技术能力本身就是业务边界的一部分，可在更高层用例中组合多个技术 port；
- 但 `domain/ports` 仍应优先描述 feature 需要“做什么”，而不是“用什么技术做”。

## 4. usecase 检查

每个 usecase 至少回答：

1. 依赖是否全部来自 `domain/ports` / `domain/types`？
2. 返回值是否是领域类型，而不是 data record / wire 结构？
3. 失败语义是否在 usecase 层统一，而不是泄漏底层实现细节？
4. 是否把规则留在 usecase，而不是散落在 command / adapter？

## 5. adapter 检查

每个 `data/*` adapter 至少回答：

1. 是否只实现端口，不额外定义业务规则？
2. 是否把外部协议/存储细节拦在 adapter 边界内？
3. 是否避免把 wire 结构直接向上穿透到 usecase？

## 6. command / di 检查

要求：

- `commands.rs` / `di/commands.rs` 负责：
  - 读取输入
  - 装配 adapter
  - 调用 usecase
  - 映射输出
- 不负责：
  - 长流程业务决策
  - 重复的业务校验
  - data 层 fallback 策略拼装

## 7. 快速审核问题

PR 审查时至少检查：

1. `usecases/` 是否直接引用了 `data/`？
2. `domain/ports/` 是否仍在表达业务语义？
3. `commands` 是否只承担 composition root 责任？
4. DTO / record / storage model 是否被限制在 `data` 边界？
5. 业务规则是否停留在 usecase，而不是下沉到 adapter 或上浮到 command？
