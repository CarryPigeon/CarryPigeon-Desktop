# Changelog

本文件记录 CarryPigeon Desktop 的主要变更。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 新增功能

### 性能优化

### UX 改进

### 国际化

### 代码质量

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
