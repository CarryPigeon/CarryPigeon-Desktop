# Changelog

本文件记录 CarryPigeon Desktop 的主要变更。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 新增功能
- **设置页左栏搜索**：设置页左栏新增搜索框（原生输入 + 内联 SVG 放大镜，样式与设置页玻璃面板一致），有查询时结果列表替换分区导航，支持 `↑`/`↓` 移动、`Enter` 跳转、`Esc` / 清空按钮恢复导航；点击结果滚动到目标并短暂高亮。搜索基于单一真源 `src/features/settings/presentation/settingsCatalog.ts`（内置 21 项索引 + 模板 `data-settings-item` 锚点，单测校验二者不漂移），匹配「标题 / 说明 / 追加关键词 / 分区名 / 插件 id」，空格分词取 AND。
- **插件可向设置页添加设置项（`ctx.ui.registerSettingsItem`）**：新增插件能力，插件在 `apply` 内注册 `{ id, title, description?, keywords?, order?, component }`（需 `ui` 权限）；宿主按 server 维护纯数据注册表 `runtime/pluginSettingsRegistry.ts`，由 `domainRegistryStore` 投影为响应式 `pluginSettingsItems`（组件统一 `markRaw`），设置页新增「插件设置」分区（按插件分组、单项独立 `ErrorBoundary`、宿主提供卡片外壳），并经 `plugins/api → forServer(socket).listPluginSettingsItems()` 跨 feature 只读消费；插件停用/卸载或切换 server 后设置项立即消失。设置值由插件用 `ctx.storage` 自行持久化。
- **内置 ai-summary 插件改用插件设置提供「AI 摘要后端」**：新增 `plugins/ai-summary/src/domain/summarizeBackend.ts`（纯逻辑）与设置项控件，可选「自动（优先客户端 AI，未配置回退服务端，保持历史行为）/ 仅客户端 AI（未配置时提示且不静默回退）/ 仅服务端（忽略客户端 AI 配置）」，偏好经 `ctx.storage` 按 server 持久化；面板在请求前载入该偏好，且「仅服务端」档不再展示客户端 AI 引导。

### UX 改进
- **设置页右侧改为分区 Tab 切换**：左栏导航由「滚动定位 + `IntersectionObserver` 滚动高亮」改为 Tab（`role="tablist"` / `role="tab"` + `aria-selected`），点击任一导航项只切换右栏当前分区面板（非当前面板 `v-show` 隐藏但保持挂载，插件设置项控件与「AI 服务」不在切换时重新挂载/重打 IPC），并把右栏滚动复位到顶部，不再对整页 `scrollIntoView`；搜索跳转改为「先切到目标分区 Tab，再在面板内滚动 + 高亮」。「插件设置」（当前 server 无插件设置项）与「关于」（应用信息未就绪）导航项不出现，保证每个导航项都有已渲染面板；分区集合变化后当前 Tab 不存在时自动回退到「通用」。
- **置顶频道改为应用内可视化编辑**：服务器卡菜单「编辑置顶频道」不再用系统默认程序打开本机 `channel-pins.json`，改为打开应用内弹窗，支持搜索频道、置顶 / 取消置顶、拖拽或方向按钮排序，并一次性保存整份有序列表；顺序即频道栏置顶分组的展示顺序，用户无需再手动编辑 JSON。新增 Rust `channel_pins_set_order` 命令与 `channel_pin_order` 纯逻辑校验，移除 `channel_pins_file_path` / `channel_pins_open_file` 与对应错误文案。
- **内置插件入口图标更贴合语义**：`theme` 工具栏入口 `palette` → `contrast`（面向亮/暗/跟随系统的外观切换，不再被误读为配色）、`group-notice` `notification` → `loudspeaker`（避免与宿主 `@提醒` 铃铛同形）、`ai-summary` `city-12` → `ai-article`（AI 摘要文档）；插件面板标题与群公告气泡图标同步更新。
- **右键菜单统一为应用风格并屏蔽 WebView2 原生菜单**：新增 `src/shared/ui/contextMenu/*`（`ContextMenuSurface` / `ContextMenuItem` / `ContextMenuSeparator` / `ContextMenuLabel` / `ContextMenuHost`）与 `src/shared/utils/contextMenu.ts`；在 `App.vue` 挂载全局宿主，右键输入框给出「撤销 / 重做 / 剪切 / 复制 / 粘贴 / 全选」（带快捷键提示与置灰规则），选中文本给出「复制 / 全选」，其余位置仅屏蔽原生菜单。既有消息 / 频道 / 服务器 / 服务器 DND / 文件列表 5 处菜单迁移到同一套基元（简洁实心面板：`--cp-surface` + 圆角 14px + `--cp-shadow-float`，面板 z-index 10050），并补齐此前仅被引用、从未定义的 `--cp-shadow-float` token。「粘贴」走官方剪贴板插件（新增 `tauri-plugin-clipboard-manager` 依赖与 `clipboard-manager:allow-read-text` 权限），规避 WebView2 默认拒绝 `clipboard-read` 的问题；dev 构建保留 `Shift + 右键` 原生菜单逃生舱。
- **聊天消息区窄宽度自适应（面板被压窄时更协调）**：消息区不再横向滚动（`.cp-signalPane` 由 `overflow: auto` 改为 `overflow-x: hidden` + `overflow-y: auto`，此前内容超宽会在消息区底部冒出横向滚动条），中间栏 `.cp-center` 建立容器查询上下文并按面板实测宽度做两级密度降级（≤520px：内边距 14→10px、头像列 44→40px、行间距 12→10px、meta 下边距 8→6px；≤400px：内边距→8px、行间距→8px、名称与时间同步 12→11px 且允许换行），窗口缩放与仅拖动 channel-message resizer 压窄面板同样生效，面板 ≥521px 时观感与改动前一致。同时补齐可收缩链修复引用卡片被右缘裁切：`.cp-quoteReply__preview` 等 `nowrap` flex 子项此前缺 `min-width: 0`（flex 默认 `min-width: auto` 拒绝收缩），导致 `text-overflow: ellipsis` 永不触发、卡片直接撑破消息行；并为 `.cp-messageContent` / `.cp-bubble` / `.cp-pluginBubble` / `.cp-replyMini` 补 `min-width: 0` 与 `max-width: 100%`，新增样式契约测试 `patchbayNarrowLayout.test.ts` 钉住上述关键声明。

### 国际化
- 新增设置搜索与插件设置分区中英文键值（搜索占位/清空/结果计数/空态、插件设置分区标题与副标题、插件来源标签）。
- ai-summary 插件新增后端设置项中英文文案（档位标签与逐档说明、保存失败、仅客户端 AI 未配置提示）。

### 代码质量
- **依赖安全升级**：rustls-webpki 0.103.15 → 0.103.16、wasmtime 48.0.6 → 48.0.7、webpki-root-certs 1.0.9 → 1.0.10，修复 RUSTSEC-2026-0378 / 0379 / 0382 / 0383，CI `cargo deny check` 的 advisories 恢复通过；`deny.toml` 清理依赖升级后已失效的旧 ignore 项，并补充 zbus 5.x 系列 unmaintained 公告（RUSTSEC-2026-0370 / 0371 / 0372）的忽略说明。

## [0.6.0] - 2026-10-03

### 新增功能
- **插件运行时 Cordis 重构（入口契约 v2）**：以 `@cordisjs/core` v3 的 `Context` 完全替换自研作用域内核。新增 `src/features/plugins/runtime/**`（`createServerContext` / `applyPlugin` / `legacyAdapter` / `permissions` / `services/*`）与 `src/features/plugins/sdk`，删除 `pluginScope`、`pluginScopeRegistry`、`hostApiFactory`、`domainRegistryContext`、`domainRegistryBindings`、`pluginUiApi` / `pluginInvokeApi` / `pluginEventApi`。宿主能力改为 Cordis 服务（`storage` / `domains` / `network` / `ai` / `messages` / `ui` / `ipc`），生命周期交由 Cordis 管理（`ctx.plugin` / `fiber.dispose` / `ctx.effect` / `ctx.on("dispose")`）。
- **插件入口契约 v2**：插件改为 `{ name, manifest, inject, apply(ctx) }`，`renderers` / `composers` / `contracts` 由模块静态导出改为运行时注册到 `ctx.domains`；v1 旧插件由 `legacyAdapter` 原样兼容（`entryApiVersion` 缺省即 1），远端已发布 v1 插件零改动可运行。
- **权限 = 服务可见性**：按 `manifest.permissions` 决定插件 context 上存在哪些能力服务，插件以 `inject` 声明依赖（支持可选依赖）；apply 前 `assertRequiredPermissions` 显式失败并 markFailed，杜绝“加载成功但不生效”的静默 pending。
- **IPC 白名单改为 manifest 声明**：新增 `ipcPrefixes` 字段替换宿主硬编码的 `voice_call:` 前缀，并与宿主可暴露命名空间白名单双重约束（拒绝 `*`、空串等过宽前缀）；`invoke` 与 `events` 权限分别门控，互不越权。
- **频道置顶（本地离线）**：服务端暂未提供置顶 API，置顶信息写入本机 `channel-pins.json`（`{app_data_dir}` 下），频道栏置顶分组独立展示。新增 Rust `channel_pins` feature（`channel_pins_get` / `set` / `toggle` / `file_path` / `open_file`）与 `channel-pins-changed` 事件；后台轮询文件变化并向前端广播完整状态，手动编辑 JSON 后无需重启即可生效。
- **客户端可替换 AI 服务（OpenAI 兼容协议）**：新增 Rust `features/ai` 与 `shared/secure_store`，密钥经系统凭据管理器存取（仅单向写入、无读取接口回传，`providerId` 白名单校验、错误文本统一脱敏），请求经 reqwest 直连以避开 WebView CORS 限制。设置页新增「AI 服务」分区，支持 OpenAI / DeepSeek / 阿里百炼 / Kimi / 本地 Ollama / 自定义 / 跟随服务端 7 种来源与模型列表一键拉取。
- **AI 摘要插件增强**：`ai-summary` 摘要范围选择、请求构造与宿主桥接补齐；新增 `channelMessageProjection` 与 `chatPluginMessagesBridge` 支撑插件只读读取当前频道消息。
- **消息引用跳转**：回复引用块与内联引用支持右键「跳转到被回复的消息」及引用块跳转按钮，虚拟列表按索引定位目标行后滚动并高亮；原消息已删除 / 撤回时不显示入口。
- **theme 插件改为宿主主题薄代理**：不再持有主题状态，读写宿主 `carrypigeon:theme`，首次激活一次性迁移旧版插件私有偏好；`system` 偏好跟随系统配色并监听变化实时同步。

### 修复
- **release 包日志文件恒为空**：`main.rs` 入口提前 `init()` 全局 tracing subscriber，导致 `app::run()` 中文件日志层 `try_init()` 必然失败；改为统一交由 `app::run()` setup 阶段初始化。
- **release 下写请求因 CORS 失败**：桌面端 HTTP 统一走 Rust（reqwest）通道，修复 WebView `app://` origin 直连服务端触发预检、导致登录等写请求在 release 中失败的问题；请求超时 30s → 45s 并记录完整 reqwest 错误链。
- **release 下自带插件加载与浮层交互**：dev / release 一致加载自带插件并产出 `public/plugins`；按入口 URL 幂等注入插件 `style.css`；浮层 Teleport 到 body 并交还指针事件，修复“透明浮层铺满全屏吃掉所有点击”；插件组件在唯一收口点统一 `markRaw`；插件目录拉取失败回退自带条目。
- **会话恢复**：启动恢复当前用户前先等待加密缓存水合，access token 过期先刷新，刷新后仍 401/403 才清空本地会话，非鉴权错误保留会话等待重试。

### 国际化
- 新增置顶频道中英文键值（频道栏置顶分组、置顶 / 取消置顶、失败提示、编辑置顶频道入口）。
- Rust 侧新增置顶频道错误键（保存失败 / 打开文件失败）中英文覆盖。

### 代码质量
- **依赖安全升级**：wasmtime 48.0.3 → 48.0.5，修复 RUSTSEC-2026-0325 / 0326 / 0327（wasmtime GC 与 component 回调缺陷，修复区间为 >=48.0.4,<49.0.0），CI `cargo audit` 与 `cargo deny check` 恢复通过。
- 插件 runtime 日志改走 `createLogger`（英文日志 + Action 词汇表），替代散落的直接输出。
- 设计文档同步 Cordis 契约：新增 `docs/design/plugin/CORDIS-MIGRATION.md`，更新 `PLUGIN-ENTRY-API.md` / `PLUGIN-MANIFEST.md` / `PLUGIN-RUNTIME.md`。
- 测试：Vitest 83 suites / 654 tests 全部通过；Rust 217 passed / 2 ignored / 0 failed。

## [0.5.0] - 2026-09-21

> 说明：v0.5.0 已打标签发布但当时未记录 CHANGELOG，本节按 `v0.4.0..v0.5.0` 提交补记。

### 新增功能
- **内置插件首批落地**：新增 theme / markdown / group-notice / ai-summary 四个默认启用插件；插件运行时引入 cordis-style `PluginScope` 生命周期（为 0.6.0 的 Cordis 重构铺路）。
- **频道发现与协作能力补全**：发现筛选、提及收件箱、审计日志、通讯录 UID 查找的 UI 与服务端接线；移除假的“添加好友私聊”入口。
- **设置与主题**：支持主题跟随系统；优化截图与输入区交互；主题收敛为亮 / 暗两种并兼容迁移旧主题值。

### 修复
- 修复大量历史消息时频道跳底失败；移除消息表情回应功能。
- 修复 release 白屏与离线 TDesign 图标缺失。
- 修复消息发送后列表未落到最新消息，进入频道时同样定位到最新。
- 对齐服务端 204 / 幂等 / 下载 302 等协议行为。

### 代码质量
- 清理旧网络层并抽取 patchbay 视图模型。
- libspa-sys 本地补丁：bindgen 升级到 0.72，适配 clang >= 21 下的 Linux 构建。
- CI Rust 规范扫描范围收敛到 `src-tauri/src`。

## [0.4.0] - 2026-07-02

### 新增功能
- **聊天内代码片段审查**：v0.4.0 本地 MVP，支持 triple-backtick 代码块行号渲染、点击行添加/删除注释、localStorage 持久化，适配线程与普通频道。
- **通知中心**：应用内铃铛面板、通知声音开关、频道级通知级别（全部消息 / 仅提及 / 静音）。
- **全局勿扰（DND）**：设置页新增全局 DND 开关，通知决策链统一检查。
- **截图工具**：全屏捕获、标注工具、截图叠加窗口、磁盘持久化、标准模式 / 不隐藏窗口模式，并配套 i18n。
- **视频通话与屏幕共享**：P2P / 会议视频通话、屏幕共享、设备热插拔检测、静音 / 降噪状态同步。
- **语音通话**：P2P 直呼、多人会议、噪声抑制、设备选择与热插拔检测。
- **消息能力增强**：消息撤回、转发（合并 / 独立模式并显示转发来源）、引用回复、线程回复、自定义表情、链接预览、消息多选批量操作、编辑状态视觉反馈。
- **频道管理**：频道静音、频道上下文菜单（复制 ID / 名称、置顶、设置、删除历史）。
- **安全聊天缓存**：AES-GCM 加密本地消息缓存，全局聊天状态迁移至安全缓存。
- **插件系统加固**：权限模型、包签名 / SHA256 校验、同源策略、TLS fingerprint 校验、wasmtime 沙箱隔离。
- **关于页面**：新增 `/about` 路由与关于页面。
- **设置体系**：主题 / 语言 / 关闭到托盘 / 诊断模式 / 导入导出 / 重置 / 自动登录 / 自动启动等偏好。
- **托盘体验**：未读徽标闪烁、本地化菜单、托盘弹窗、窗口尺寸切换。
- **错误边界与全局错误处理**：关键页面增加错误边界，统一日志与错误码。

### 性能优化
- **Web Worker 自适应消息排序**：合并后消息数 > 2000 时 offload 到 Worker，小数据量回退主线程。
- **统一限流工具 `rateLimit.ts`**：替换手写防抖，覆盖搜索输入、聊天刷新、异步去重场景。
- **聊天刷新去重**：`refreshChannels` / `refreshChannelLatestPage` / `refreshMembersRail` 使用 `asyncDedupe` 避免并发重复请求。
- **消息列表虚拟滚动**：基于 `@tanstack/vue-virtual`，按消息类型精细化 `estimateSize`（图片/视频 220px、普通 52px、紧凑 32px）。
- **构建产物优化**：全部路由内联动态导入，`ImageLightbox` 懒加载，`MainPage` 体积从 ~435 KB 降至 ~227 KB（-48%）。
- **连接与资源**：WebSocket 连接池复用（LRU 驱逐、闲置清理）、图片懒加载（IntersectionObserver + 退避重试）。
- **启动与运行时**：启动耗时埋点、依赖预优化、内存监控与泄漏检测、诊断模式、性能基准回归检测（`pnpm benchmark`）。
- **后端 IO 与事件节流**：下载进度事件按 100ms / 64KB 聚合；TCP 状态事件 200ms 同状态去重；`get_config_value` 增加 500ms TTL 内存缓存，高频配置写入 100ms 批量 flush。
- **安全聊天缓存上限**：聊天缓存条目上限 8192，超限后按 LRU（updated_at 升序）淘汰至 80%。
- **文件 IO 流式化**：新增 `read_file_base64_chunk` 分块读取本地文件；语音消息、截图转附件改为流式组装 Blob；普通文件上传直接传递 `File`/`Blob`，避免 `arrayBuffer()` 一次性载入内存。
- **语音通话超时取消**：Dialing / Ringing 状态 60s 无应答自动挂断并通知前端。
- **前端消息列表内存窗口**：单频道保留最近 3000 条消息，长时间运行场景下限制内存增长。
- **诊断面板**：设置页新增诊断弹窗，展示内存快照、趋势、状态、手动清理与最近应用日志。

### UX 改进
- **头像组件统一**：`AvatarBadge` 支持真实图片 + 首字母 fallback。
- **文件附件体验**：发送成功后自动清理已上传项，失败项保留供重试；支持多选图片 / 视频统一上传；文件预览条 hover 高亮、点击预览。
- **媒体消息**：视频消息支持播放、缩略图、灯箱预览、错误重试；灯箱升级旋转、下载、全频道媒体导航。
- **窗口行为**：关闭到托盘可配置，并下沉到 data 层缓存同步。
- **搜索与快捷操作**：频道级 + 服务器级搜索面板、键盘快捷键支持。
- **设置交互**：设置页按业务 / 通用 / 外观分区，支持导入 / 导出 / 重置配置。
- **Composer 链接预览防抖**：检测到 URL 后 400ms 防抖再请求 `fetch_link_preview`，避免输入过程中高频 IPC。
- **启动反馈增强**：`StartupShell` 根据初始化阶段显示“初始化运行时 / 连接服务器 / 检查必要组件 / 恢复会话”文案，支持中英双语。
- **i18n/ARIA 补缺**：图标按钮添加 `aria-label` 与缺失 i18n 键值，提升屏幕阅读器可访问性。

### 国际化
- 中文（zh_cn）与英文（en_us）完整覆盖 Rust 错误消息、托盘菜单、设置、搜索、设备选择、文件操作、视频、灯箱、频道静音、通知中心等场景。
- 新增 i18n 键值一致性测试，避免中英键值缺失。

### 代码质量
- **架构落地**：Feature-first + Clean Layers；`src/features/<feature>/api.ts` 作为唯一跨 feature 入口；feature 边界检查脚本 `scripts/check-feature-boundaries.sh`。
- **类型安全**：`VirtualListItem` 使用联合类型替代 `any`；修复 `ComposerHost.vue` v-else 链语法错误。
- **Rust 规范**：生产代码移除 `unwrap` / `expect` / `panic!` / `todo!`；日志规范检查、Rust 标准检查脚本。
- **测试覆盖**：Rust 150 个测试通过、前端 Vitest 161 个测试通过；新增截图叠加层测试、i18n parity 测试、聊天缓存淘汰测试、分块文件读取测试。
- **Tauri 命令名统一**：前端所有 `invoke` / `invokeTauri` 命令字符串收敛到 `TAURI_COMMANDS`，消除散落硬编码。
- **CI/CD**：GitHub Actions 串联 `pnpm lint` → `pnpm build` → `cargo test` → `cargo audit` → `cargo deny check` → 跨平台 Tauri 构建 → draft release。
- **安全加固**：CSP 策略收紧、路径遍历防护、插件包校验、敏感数据加密缓存。
- **更新策略调整**：移除 Tauri 自动更新插件，保留手动版本检查与 GitHub Releases 下载引导。
- **Mock 配置收敛**：统一使用 `@/shared/config/runtime`，移除业务代码中对 `import.meta.env` 的直接判断。
- **日志命令**：新增 `read_app_log_lines` Tauri 命令，支持诊断面板读取最近日志。
- **安全审计配置**：新增 `.cargo/audit.toml`，记录接受的 RUSTSEC-2023-0071 风险。

## [0.3.0] - 2026-06-21

### 新增功能
- **文件管理器全面增强**：文件工具栏（批量操作）、预览面板（图片/文档预览）、删除确认对话框、下载进度提示
- 文件排序（名称/大小/类型/日期）、筛选、多选、无限滚动
- 文件批量删除功能
- 视频消息支持：播放、缩略图、灯箱预览、错误重试
- 关闭窗口到托盘行为（可配置，内存缓存加速）
- 语音通话设备热插拔检测（3s 轮询）
- 灯箱升级：旋转、下载、视频播放、全频道媒体导航
- AvatarBadge 统一头像组件：支持真实图片 + 首字母 fallback
- 文件附件预览条交互优化（hover 高亮、点击预览）
- 文件上传支持多选（图片/视频），发送时统一上传

### 性能优化
- 虚拟滚动 estimateSize 精度提升：按消息类型区分高度（image/video=220px, grouped=52px, compact=32px），减少滚动抖动
- 全部路由改为内联动态导入，Vite code splitting 更精确
- MainPage 构建体积从 ~435 KB 降至 ~227 KB（-48%）
- ImageLightbox 改为 `defineAsyncComponent` 懒加载，仅在用户点击图片时加载
- ThreadPanel 回复列表引入 `@tanstack/vue-virtual` 虚拟滚动

### UX 改进
- 消息编辑状态增加视觉反馈（虚线边框 + 背景色高亮）
- 消息发送后自动清理成功上传的附件，保留失败项供重试
- 消息模型增强：正确处理多个 [file:xxx] 附件引用的消息
- 语音通话默认设备自动选中（用户选择 > 系统默认）
- 语音通话静音/降噪状态同步优化（避免 poll 陈数据覆盖）
- 用户资料页路由统一为 kebab-case（/user_info → /user-info）
- Mock 用户服务头像/背景上传持久化

### 国际化
- 新增文件操作、视频、灯箱、搜索、设备选择等 i18n 键（中文/英文）
- 用户资料加载错误消息迁移至 i18n（load_failed）

### 代码质量
- Rust config_store 测试修复：防止 `APP_DATA_DIR` 全局状态污染导致 5 个测试连锁失败（PoisonError）
- Rust 全部 39 个测试通过，0 failed
- Frontend Vitest 全部 88 个测试通过
- close_to_tray 缓存同步下沉到 data 层（ConfigStorePortAdapter），di/commands 层职责单一
- Rust 依赖清理：移除 dev profile 冗余 `incremental = true`

## [0.2.0] - 2025-06-15

### 新功能
- 聊天消息虚拟滚动（@tanstack/vue-virtual）
- 图片消息支持：懒加载、缩略图、灯箱预览
- 语音消息：录制、发送、播放
- 消息搜索面板（频道级 + 服务器级）
- 键盘快捷键支持
- 错误边界包装
- 系统托盘：未读徽笔闪烁、本地化菜单
- 自动更新检查
- 设置导入/导出
- 插件中心：搜索、安装、更新、卸载
- 频道发现与加入申请
- 成员管理（管理员设置、移除成员）
- 入群申请审批
- 禁言管理
- 语音通话：P2P 直呼、多人会议、降噪/静音
- WebSocket 连接池（连接复用、LRU 驱逐、闲置清理）
- 图片懒加载（IntersectionObserver + 重试退避）
- 前端内存监控（定时采样、趋势分析、阈值告警）
- 路由懒加载（LoginPage 及弹窗路由动态导入）
- 防抖/节流工具（rateLimit.ts）

### 性能优化
- Vite 构建配置：手动分块、依赖预优化
- SQLite PRAGMA 优化：WAL 模式、NORMAL sync、8MB cache
- 启动性能优化

### 国际化
- 支持中文（zh_cn）和英文（en_us）
- Rust 侧 i18n 基础设施
- 错误消息和托盘菜单翻译

### 架构
- Feature-first + Clean Layers 架构
- 完整的开发文档和规范

## [0.1.0] - 2025-05-01

### 新功能
- 初始版本
- 用户认证和登录
- 聊天消息发送和接收
- 文件上传和下载
- 频道管理
- 多服务器管理
- 个性化主题
