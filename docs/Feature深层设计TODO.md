# Feature 深层设计 TODO

按优先级执行，不做“只写规范不落地”的整改。

## P0 当前执行

- [x] `chat`：把 `selectChannel` 从 `Promise<void>` 收敛为显式 `Outcome`，并同步消费方。
- [x] `chat`：检查频道切换相关页面/弹窗/quick-switcher 是否仍把业务失败静默吞掉。
- [x] `server-connection`：减少对低层 `connectivity/server-info` 子域入口的直接消费，优先统一走根 `workspace` capability。

## P1 下一轮

- [ ] `chat`：继续审查 `room-session` 其余公开命令，确认哪些仍应提升为 `Outcome`。
- [ ] `server-connection`：统一 `runtime / workspace / scope-lifecycle` 的公开层级，进一步内收低层 API。
- [ ] `features/*/README.md`：补齐“职责 / 不负责 / 根入口 / 数据流”四段式说明。
- [ ] `typechecks/`：为更多 feature 根 capability 增加编译期回归检查。

## P2 体系固化

- [ ] 为新 feature 整理统一目录模板与 README 模板。
- [ ] 持续收敛仍由 `Promise<void>` 承担业务语义的公开命令。
- [ ] 对低层子域 API 建立“仅 feature 内使用”的共识并逐步清理外部消费面。

## 已完成

- [x] 统一 feature runtime lease ownership，移除重复的 lease 状态机模板。
- [x] 统一 `latest-wins` 命令控制器，替换手写 generation 变量。
- [x] 规范文档补充“生命周期 ownership / 命令并发语义 / 局部 capability / Rust usecase 边界”。
- [x] `chat` 收敛更细粒度局部 capability：按 channel / governance / composer 下钻。
- [x] `plugins` 抽出插件安装状态机 policy，避免安装流程规则散落在 store helper。
- [x] `server-connection` 抽出 workspace switch policy，明确 select/connect/refresh 的原子性边界。
- [x] `account` 建立身份可信等级模型，区分 authenticated snapshot 与 authority profile。
- [x] 仓库级统一 command policy 命名与注释模板。
- [x] 为 capability snapshot/readable contract 增加更多 typecheck。
- [x] 为 Rust feature 增加 ports-adapter 结构检查清单。
