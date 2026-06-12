# tray-notification 重构设计

> 日期：2026-06-05
> 状态：已确认
> 方案：A — 渐进式搬迁

## 背景

`tray-notification` feature 目前只有一个空壳（`routes.ts` + `TrayNotificationPopover.vue`），核心集成逻辑散落在 `src/app/bootstrap/` 的 4 个 bridge 文件中：

- `trayHoverBridge.ts` — 托盘悬停弹窗
- `trayUnreadBridge.ts` — 未读计数 → 托盘闪烁
- `trayLocaleBridge.ts` — 语言同步
- `notificationBridge.ts` — 桌面通知

此外，`close_to_tray` 设置虽已持久化并有 UI 切换开关，但 Rust 端未实现实际行为——关闭窗口始终退出应用，不会隐藏到托盘。

## 目标

将 `tray-notification` 重构为符合项目 Feature 模块设计规范的标准模块，并补齐 `close_to_tray` 行为。

## Feature 模块结构

```
src/features/tray-notification/
├── api.ts              # createTrayNotificationCapabilities()
├── api-types.ts        # 稳定的公开类型
├── routes.ts           # 路由定义（保持）
├── composition/        # DI 装配根
│   └── createTrayNotificationRuntime.ts
├── domain/             # 纯业务模型，无 Vue/Tauri 依赖
│   ├── model.ts        # TrayState, NotificationPolicy, UnreadPreview
│   └── ports.ts        # FlashingPort, LocalePort, PopoverPort, NotificationPort
├── data/               # Tauri 适配器实现
│   └── tauri/
│       ├── tauriFlashingAdapter.ts
│       ├── tauriLocaleAdapter.ts
│       ├── tauriPopoverAdapter.ts
│       └── tauriNotificationAdapter.ts
├── presentation/       # Vue 组件（保持）
│   └── pages/
│       └── TrayNotificationPopover.vue
├── mock/               # Mock 实现
│   └── mockTrayPorts.ts
└── typechecks/         # 编译时契约检查
    └── trayCapabilityCheck.ts
```

## Domain 模型

### 端口接口（`domain/ports.ts`）

```typescript
// 托盘图标闪烁控制
interface TrayFlashingPort {
  setFlashing(hasUnread: boolean): Promise<void>;
  clearFlashing(): Promise<void>;
}

// 托盘菜单语言
interface TrayLocalePort {
  setLocale(locale: string): Promise<void>;
}

// 弹窗窗口控制
interface TrayPopoverPort {
  openPopover(position: ScreenPosition, previews: UnreadPreview[]): Promise<void>;
  closePopover(): Promise<void>;
}

// 桌面通知
interface DesktopNotificationPort {
  sendNotification(params: NotificationParams): Promise<void>;
}
```

### 领域模型（`domain/model.ts`）

```typescript
// 托盘交互状态快照（不可变 plain object）
interface TrayStateSnapshot {
  hasUnread: boolean;
  isFlashing: boolean;
  isHovering: boolean;
  popoverOpen: boolean;
  locale: string;
  closeToTray: boolean;
}

// 通知决策策略（纯函数，从 notificationBridge 条件链提取）
interface NotificationPolicy {
  shouldSendDesktopNotification(context: {
    isAppFocused: boolean;
    notificationPreference: 'all' | 'mentions' | 'none';
    hasMention: boolean;
    isCurrentChannel: boolean;
  }): boolean;
}
```

**设计约束：**
- `domain/` 不依赖 Vue、Tauri 或浏览器 API
- `TrayStateSnapshot` 是不可变的 plain object
- 所有端口返回 `CommandResult<T>`
- `NotificationPolicy` 是纯函数，可独立单元测试

## 数据流

```
chat.session.directory.totalUnreadCount (Observable)
    │
    ├──[observeSnapshot]──→ TrayFlashingPort.setFlashing() → Rust set_tray_unread_flashing
    │
Rust tray-hover-settled 事件
    │
    └──→ 获取 UnreadPreview[] → TrayPopoverPort.openPopover()

新消息事件
    │
    └──→ NotificationPolicy.shouldSend() → DesktopNotificationPort.send()
```

## Composition（DI 装配）

```typescript
// createTrayNotificationRuntime.ts
export function createTrayNotificationRuntime(
  ports: TrayPorts,
  dependencies: {
    unreadCount: Observable<number>,
    unreadPreviews: (n: number) => Promise<UnreadPreview[]>,
    notificationEvents: Observable<NewMessageEvent>,
    windowFocus: Observable<boolean>,
    locale: Observable<string>,
    closeToTray: Observable<boolean>,
  }
): TrayNotificationRuntime
```

Runtime 通过 `dependencies` 接收外部 observable，不直接 import 其他 feature 的内部文件。所有 Tauri 调用封装在 `data/tauri/` adapter 中。

## Public API

```typescript
// api-types.ts
interface TrayNotificationSnapshot {
  hasUnread: boolean;
  isFlashing: boolean;
  popoverOpen: boolean;
  unreadPreviewCount: number;
}

interface TrayNotificationDependencies {
  unreadCount: Observable<number>;
  unreadPreviews: (limit: number) => Promise<UnreadPreview[]>;
  notificationEvents: Observable<NewMessageEvent>;
  windowFocus: Observable<boolean>;
  locale: Observable<string>;
  closeToTray: Observable<boolean>;
}

// api.ts
function createTrayNotificationCapabilities(
  deps: TrayNotificationDependencies
): TrayNotificationCapabilities

interface TrayNotificationCapabilities {
  getSnapshot(): TrayNotificationSnapshot;
  observeSnapshot(observer: (s: TrayNotificationSnapshot) => void): Unsubscribe;
  setLocale(locale: string): Promise<void>;
  dismissPopover(): Promise<void>;
  acquireLease(): Promise<TrayNotificationLease>;
}

interface TrayNotificationLease {
  release(): Promise<void>;
}
```

**API 设计原则：**
- 遵循 Object-Capability 模式
- `observeSnapshot` 只暴露 plain data，不泄露 Vue 响应式
- `acquireLease` 确保最后一个消费者释放后才停止运行时
- 不暴露内部端口、domain 模型或 Vue 组件

## 迁移计划

### Phase 1 — 搭骨架
- 创建 `domain/model.ts`, `domain/ports.ts`
- 创建 `api-types.ts`, `api.ts`（空实现）
- 创建 `typechecks/`
- **验证：** typecheck + feature boundaries 通过
- **影响：** 0 个现有文件

### Phase 2 — 搬适配器
- 创建 `data/tauri/` 下 4 个 adapter
- 从 bootstrap bridge 中提取 Tauri 调用代码
- 创建 `mock/mockTrayPorts.ts`
- **验证：** mock 模式下功能正常
- **影响：** 新建文件，不修改现有 bridge

### Phase 3 — 搬业务逻辑
- 创建 `composition/createTrayNotificationRuntime.ts`
- 将 `trayUnreadBridge` 逻辑 → runtime 内部
- 将 `trayHoverBridge` 逻辑 → runtime 内部
- 将 `trayLocaleBridge` 逻辑 → runtime 内部
- 将 `notificationBridge` 策略 → `NotificationPolicy`
- `api.ts` 实现完整能力
- **验证：** 端到端功能正常
- **影响：** 修改 bootstrap/ 调用点

### Phase 4 — 切调用方
- `app/bootstrap/` 改为调用 `trayNotificationCapability`
- chat feature 通过 capability 连接
- 删除旧的 4 个 bridge 文件
- **验证：** 端到端功能不变
- **影响：** bootstrap 瘦身

### Phase 5 — 修 close_to_tray
- Rust 侧：`app/mod.rs` 添加 `CloseRequested` 处理器
- 读取 `ConfigStore` 中的 `close_to_tray` 设置
- `true` → `hide()` 主窗口，`false` → `exit(0)`
- 托盘菜单 "显示主窗口" 调用 `show()` + `set_focus()`
- **验证：** 设置页切换开关后行为正确生效

### 每 Phase 验证清单
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint:feature:boundaries` 通过
- [ ] `pnpm lint:logs:std` 通过
- [ ] mock 模式下手动测试托盘功能
- [ ] Rust `cargo test -- --test-threads=1` 通过

## 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 搬迁策略 | 渐进式（5 Phase） | 每步可验证，风险低，不影响其他功能 |
| close_to_tray 时机 | Phase 5 最后修 | 等 domain 模型就绪后再修，改动更小 |
| Runtime 依赖 | 构造函数注入 | 不直接 import 其他 feature，保持 boundary 干净 |
| 通知策略 | 提取为纯函数 `NotificationPolicy` | 可独立测试，与 Tauri 解耦 |
| 端口命名 | `*Port` 后缀 | 与项目现有 pattern 一致 |

## 不变更范围

- `TrayNotificationPopover.vue` 的 UI 保持不变
- Rust `tray/commands.rs` 的闪烁、语言、弹窗逻辑不变
- `chat` feature 的 `UnreadPreview` 类型不变
- 桌面通知决策链的业务规则不变
