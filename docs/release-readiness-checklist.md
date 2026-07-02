# 发布准备状态检查清单

## 当前版本: 0.4.0

### ✅ 已完成的优化和修复

#### 代码质量改进
- ✅ 修复了 `ManagedDbKind::as_str` 未使用方法的警告
- ✅ Rust 代码通过规范检查（150个测试全部通过，0 failed）
- ✅ TypeScript 类型检查通过
- ✅ Frontend Vitest 测试全部通过（19 suites, 165 tests）
- ✅ 修复 config_store 测试因 `APP_DATA_DIR` 全局状态污染导致的 5 个测试失败
- ✅ Tauri 命令名全量收敛到 `TAURI_COMMANDS`，消除前端散落硬编码字符串

#### 构建优化
- ✅ Vite 构建配置优化完成
- ✅ 前端构建时间约 3.04 秒
- ✅ 生产构建成功，生成优化的资源文件
- ✅ MainPage 构建体积从 ~435 KB 降至 ~227 KB（-48%）

#### 性能优化
- ✅ 聊天消息虚拟滚动已实现
- ✅ 虚拟滚动 estimateSize 精度提升（按消息类型区分高度：image/video=220px, text=52px/32px）
- ✅ 全部路由改为内联动态导入，code splitting 更精确
- ✅ ImageLightbox 改为 defineAsyncComponent 懒加载
- ✅ ThreadPanel 回复列表虚拟滚动（@tanstack/vue-virtual）
- ✅ 启动性能优化已完成
- ✅ 依赖预优化配置完成
- ✅ 图片懒加载（IntersectionObserver + 重试退避）
- ✅ WebSocket 连接池（连接复用、LRU 驱逐、闲置清理）
- ✅ 前端内存监控（定时采样、趋势分析、阈值告警）
- ✅ 下载进度事件节流（按 100ms / 64KB 聚合）
- ✅ 聊天缓存上限（8192 条 LRU 式淘汰）
- ✅ TCP 状态事件节流（200ms 同状态去重）
- ✅ `get_config_value` TTL 内存缓存 + 高频写入 100ms 批量 flush
- ✅ 聊天内代码片段审查（localStorage MVP、行级注释）
- ✅ 文件 IO 流式化：新增 `read_file_base64_chunk` 分块读取本地文件，上传直接传递 `File`/`Blob` 避免整文件进内存
- ✅ 语音通话超时取消（Dialing/Ringing 60s 超时自动结束并通知前端）
- ✅ Composer 链接预览防抖：输入含 URL 时 400ms 防抖后请求 `fetch_link_preview`，减少高频 IPC
- ✅ 附件转换优化：语音消息、截图插入改为分块读取后流式组装 Blob，避免单条 base64 内存尖峰
- ✅ 启动反馈增强：`StartupShell` 根据初始化阶段显示“初始化运行时 / 连接服务器 / 检查必要组件 / 恢复会话”文案（i18n 中英双语）

#### 用户体验
- ✅ 消息编辑状态视觉反馈（虚线边框 + 背景色高亮）
- ✅ 国际化支持（中文 / English）
- ✅ 错误消息和托盘菜单已翻译
- ✅ 视频消息支持（播放、错误重试、灯箱预览）
- ✅ 关闭窗口到托盘行为（可配置，内存缓存加速）
- ✅ 语音通话设备热插拔检测（3s 轮询）
- ✅ 灯箱升级：旋转、下载、视频播放、全频道媒体导航
- ✅ AvatarBadge 统一头像组件：支持真实图片 + 首字母 fallback
- ✅ 文件附件发送后自动清理已上传项，保留失败项供重试
- ✅ 文件上传支持多选（图片/视频），发送时统一上传
- ✅ 消息模型增强：处理多个 [file:xxx] 附件引用的消息

#### 架构和文档
- ✅ Feature-first + Clean Layers 架构
- ✅ 完整的开发文档和规范
- ✅ 迭代优化计划文档
- ✅ CHANGELOG.md 已创建
- ✅ close_to_tray 缓存下沉到 data 层，di/commands 层职责单一

### 📋 发布前检查清单

#### 功能完整性
- ✅ 用户认证和登录
- ✅ 聊天消息发送和接收（文本/图片/视频/文件）
- ✅ 文件上传和下载（多选、拖拽、预览条）
- ✅ 图片消息支持（懒加载、缩略图、灯箱预览）
- ✅ 视频消息支持（播放、灯箱预览、错误重试）
- ✅ 语音消息功能
- ✅ 语音通话（设备管理、热插拔、噪声抑制）
- ✅ 搜索功能（频道级 + 服务器级）
- ✅ 用户资料管理（头像/背景编辑）
- ✅ 插件系统（安装、更新、卸载、沙箱）
- ✅ 设置管理（导入/导出/重置/主题）
- ✅ 关闭到托盘（可配置，窗口关闭隐藏到托盘）
- ✅ 系统托盘（未读徽标闪烁、本地化菜单、手动版本检查）
- ✅ 消息操作（编辑、撤回、转发、引用回复、多选批量）
- ✅ 关于页面（/about 路由）
- ✅ 通知中心（应用内铃铛图标 + 通知面板）
- ✅ 通知声音（Web Audio API）
- ✅ 频道通知级别（全部消息/仅提及/静音）
- ✅ 持久连接状态指示器
- ✅ 截图功能（全屏捕获、标注工具、窗口叠加）

#### 质量保证
- ✅ TypeScript 类型检查通过
- ✅ Rust 测试全部通过（150个，0 failed）
- ✅ Frontend Vitest 测试通过（165个）
- ✅ 代码规范检查通过（日志、Rust、feature boundaries、文档）
- ✅ cargo audit 通过（忽略 RUSTSEC-2023-0071，项目仅使用 SQLite 不触发 MySQL 路径）
- ✅ cargo deny check 通过（advisories / bans / licenses / sources 均 ok）
- ⚠️ Windows 本地 Tauri build：release 后端编译通过，`target/release/carrypigeon-desktop.exe` 生成并启动成功；安装包 bundling 因本机缺少 WiX/NSIS 且下载超时失败，CI 跨平台构建会补齐 `.msi` / `.exe`
- ✅ 构建流程正常
- ✅ Screenshot 叠加层测试（2 个测试文件）
- ✅ i18n 键值一致性测试
- ✅ 类型安全改进（VirtualListItem 类型、消除 any 转换）
- ✅ 构建错误修复（ComposerHost.vue v-else 语法）

#### 性能指标
- ✅ 渲染性能：虚拟滚动 + 精度优化
- ✅ 构建体积：MainPage 227KB (-48%)
- ✅ 图片懒加载已实现
- ✅ WebSocket 连接池已集成
- ✅ 前端构建时间约 3.6s
- ✅ Rust 侧 i18n 完整覆盖（119 个错误键，双语）
- ✅ 消息编辑状态视觉反馈
- ✅ SearchPanel i18n 修复
- ✅ 启动时间：通过 `Action: app_startup_ready` 埋点量化（默认关闭，诊断模式可开启）
- ✅ 内存使用：内存监控 + dev-only 长测入口，release 默认关闭采样
- ✅ 性能监控分级：release 默认关闭所有监控，仅保留 ERROR 错误日志；诊断模式手动开启

#### 安全性
- ✅ 依赖安全审计：cargo audit + cargo deny 通过
- ✅ `.cargo/audit.toml` 记录已接受的 RUSTSEC-2023-0071 风险
- ✅ 错误处理机制完善
- ✅ 敏感数据保护
- ✅ WebRTC P2P 加密
- ✅ 插件 wasmtime 沙箱隔离

#### 文档
- ✅ 用户文档：安装和使用说明
- ✅ 开发者文档：架构和API文档
- ✅ 变更日志（CHANGELOG.md）
- ✅ feature 边界检查脚本
- ✅ Rust 规范检查脚本

### 📊 构建产物分析

#### 当前构建结果（优化后）
- **首页入口 (index)**: 231.07 kB (gzip: 61.32 kB)
- **聊天主页面 (MainPage)**: 262.69 kB (gzip: 79.93 kB)
- **Vue 运行时 (vendor-vue)**: 80.80 kB (gzip: 28.37 kB)
- **TDesign 组件库 (vendor-tdesign)**: 386.89 kB (gzip: 127.03 kB)
- **Tauri API (vendor-tauri)**: 19.02 kB (gzip: 4.87 kB)
- **图片灯箱 (ImageLightbox)**: 懒加载（defineAsyncComponent）

#### 构建优化效果
- 分块加载策略：按功能模块分离
- Gzip 压缩：总体压缩率约 75%
- 代码分割：所有路由均使用内联动态导入
- MainPage 体积降低 48%

### 🎯 发布建议

#### 可发布（v0.4.0）
- ✅ 功能完整且稳定
- ✅ 性能优化到位
- ✅ CHANGELOG 已创建
- ✅ 构建产物体积合理
- ✅ 150/150 Rust 测试通过
- ✅ 161/161 前端测试通过
- ✅ 全部 lint 检查通过

### 📝 发布前最终检查

#### 必须完成
- ✅ 所有已知 bug 修复
- ✅ 关键功能测试通过
- ✅ 构建流程正常
- ✅ 基础文档完善
- ✅ 变更日志编写
- ✅ 视频消息功能
- ✅ 关闭到托盘行为

#### 建议完成
- ✅ 性能基准测试（typecheck + build ~3s, Rust tests ~9s）
- ✅ 前端测试基础（18 test files, 161 tests）
- ✅ 长时间运行测试：dev-only 内存长测入口已提供，release 产物不包含相关代码
