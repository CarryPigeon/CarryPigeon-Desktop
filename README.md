# CarryPigeon Desktop

> 自建服务器聊天与协作平台 · 桌面客户端

**CarryPigeon Desktop** 是一个跨平台桌面聊天客户端，采用 **Tauri 2 + Rust + Vue 3 + TypeScript** 构建。它连接自建聊天服务器，提供安全、高性能的即时通讯体验。

## ✨ 功能概览

### 聊天核心
| 功能 | 说明 |
|------|------|
| 💬 实时消息 | 基于 WebSocket 的即时消息收发，支持文本/图片/文件/语音 |
| 📎 文件传输 | 文件上传/下载管理，支持拖拽、断点续传 |
| 🖼️ 图片消息 | 懒加载、缩略图、灯箱预览 |
| 🎤 语音消息 | 录制、发送、播放 |
| 🔄 消息操作 | 编辑、撤回、转发（合并/逐条）、引用回复、多选批量 |
| 🧵 消息线程 | 基于根消息的回复线程 |
| 📌 消息置顶 | 频道置顶消息管理 |
| 🔍 消息搜索 | 当前频道全文搜索 |

### 频道与社区
- 频道分类管理（分类折叠、搜索）
- 频道发现与加入申请
- 成员管理（设置为管理员、移除成员）
- 入群申请审批
- 禁言管理

### 插件系统
- 插件中心：搜索、安装、更新、卸载
- 域目录（Domain Catalog）：契约与提供方检索
- 仓库源管理
- Wasm 沙箱运行时
- 供电锁扣（Power Latch）安全机制

### 语音通话
- P2P 直呼
- 多人会议
- 降噪/静音控制
- 设备选择

### 服务器与连接
- 多服务器管理（一键切换）
- TCP/TLS/不安全 TLS 传输模式
- WebSocket 连接池（自动重连、闲置清理）
- 连接状态指示器

### 个性化
- 多主题（插线板/经典/亮色）
- 国际化（中文 / English）
- 自定义表情
- 用户资料编辑（头像、背景、昵称、邮箱）

### 系统集成
- 系统托盘（未读徽章闪烁、本地化菜单）
- 自动启动、关闭到托盘
- 自动更新检查
- 设置导入/导出

## 🖼️ 截图

> 开发迭代中，截图将在 v1.0 发布时补充。当前可通过 `pnpm run tauri dev` 启动应用体验。

## 🧪 质量保证

```bash
# 完整 lint 检查（类型 + 日志规范 + Rust 规范 + Feature 边界 + 文档）
pnpm run lint

# 单项检查
pnpm run typecheck           # TypeScript 类型检查
pnpm run lint:feature:boundaries  # Feature 模块边界
pnpm run lint:logs:std       # 前端日志规范
pnpm run lint:rust:std       # Rust 编码规范
pnpm run lint:docs           # 文档样式检查

# 前端单元测试（Vitest）
pnpm run test

# Rust 后端测试
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1

# 性能基准测试
pnpm benchmark
```

## 📊 构建产物

| 产物 | 体积 (gzip) | 说明 |
|------|------------|------|
| 主入口 (index) | ~36 KB | 应用引导 + 路由 + i18n |
| 聊天主页面 | ~67 KB | Patchbay 主界面 |
| Vue 运行时 | ~28 KB | Vue 3 + vue-router + vue-i18n |
| TDesign UI | ~127 KB | 含 CSS |
| 插件中心 | ~7 KB | 懒加载页面 |
| 设置页 | ~6 KB | 懒加载页面 |

## 🧱 架构

项目采用 **Feature-first + Clean Layers** 架构：

```
src/
├── app/              # 应用引导（路由、i18n、启动流程、DI 组合）
├── features/         # 功能模块（chat / account / plugins / …）
│   ├── api.ts        # 公共能力 API（object-capability）
│   ├── api-types.ts  # 稳定公共类型
│   ├── domain/       # 领域模型（无 Vue/Tauri 依赖）
│   ├── data/         # 数据适配（HTTP/WS/Storage/Tauri）
│   ├── application/  # 应用编排
│   ├── presentation/ # UI 层（页面、组件、状态）
│   ├── composition/  # 组合根 / DI
│   └── integration/  # 跨 Feature 适配器
└── shared/           # 共享基础设施（logger / toast / clipboard / focusTrap）

## 🚀 快速开始

### 安装

从 [GitHub Releases](https://github.com/ShirasawaTopaz/CarryPigeon-Desktop/releases) 下载对应平台的最新安装包：

- **Windows**: `.msi` 或 `.exe`
- **macOS**: `.dmg` 或 `.app.tar.gz`
- **Linux**: `.deb` 或 `.AppImage`

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/ShirasawaTopaz/CarryPigeon-Desktop.git
cd CarryPigeon-Desktop

# 安装依赖
pnpm install

# 配置环境变量（可选）
cp .env.example .env

# 启动开发服务（仅前端）
pnpm run dev

# 启动 Tauri 桌面应用
pnpm run tauri dev
```

### 构建

```bash
# 前端构建
pnpm run build

# Tauri 生产构建（生成安装包）
pnpm run tauri build
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_USE_MOCK_API` | 启用 Mock 后端 | `true` |
| `VITE_MOCK_MODE` | Mock 模式 (`store` / `protocol`) | `store` |
| `VITE_MOCK_LATENCY_MS` | Mock 模拟延迟 | `120` |

## 🧱 技术栈

| 层级 | 技术 |
|------|------|
| **桌面框架** | Tauri 2 |
| **前端** | Vue 3 + TypeScript + Vite 8 |
| **UI 库** | TDesign Vue Next |
| **后端** | Rust (Tokio, SeaORM, SQLite) |
| **协议** | TCP + TLS, WebSocket, AES-GCM |
| **插件** | wasmtime 沙箱 |
| **语音** | WebRTC (P2P + 会议) |
| **i18n** | vue-i18n (zh_cn / en_us) |
| **构建** | pnpm, Vite, Cargo |

## 🏗️ 架构

项目采用 **Feature-first + Clean Layers** 架构：

```
src/
├── app/              # 应用引导（路由、i18n、启动流程）
├── features/         # 功能模块（chat / account / plugins / …）
│   ├── api.ts        # 公共能力 API
│   ├── domain/       # 领域模型（无 Vue/Tauri 依赖）
│   ├── data/         # 数据适配（HTTP/WS/Storage）
│   ├── presentation/ # UI 层（页面、组件、状态）
│   └── composition/  # 组合根
└── shared/           # 共享基础设施
```

详细架构文档：`docs/架构设计.md`

## 📊 构建产物

| 产物 | 体积 (gzip) |
|------|------------|
| 主入口 | ~35 KB |
| 聊天主页面 | ~66 KB |
| Vue + 路由 | ~28 KB |
| TDesign UI | ~126 KB (含 CSS) |

## 📖 文档

| 文档 | 说明 |
|------|------|
| [文档总览](docs/README.md) | 所有开发文档索引 |
| [项目简介](docs/项目简介.md) | 项目背景与目标 |
| [架构设计](docs/架构设计.md) | 高层架构说明 |
| [Feature 模块设计规范](docs/Feature模块设计规范.md) | 模块化开发规范 |
| [客户端协议指南](docs/客户端开发指南.md) | CPacket 协议参考 |
| [前端调试与 Mock](docs/前端调试与Mock.md) | 三种 Mock 模式使用 |

## 🧪 质量保证

```bash
# 完整 lint 检查
pnpm run lint

# 仅类型检查
pnpm run typecheck

# Rust 后端测试
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1

# 性能基准测试
pnpm benchmark
```

## 📝 许可

[Apache-2.0](LICENSE)

---

*CarryPigeon — 安全、开放的团队通讯平台*
