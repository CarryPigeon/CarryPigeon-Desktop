# 全局免打扰 & 频道免打扰 — 设计规格

## 概述

在设置中增加全局信息免打扰开关，在聊天页面增加针对不同频道的右键菜单免打扰功能。

## Part A — 全局免打扰（设置页）

### 数据流

```
SettingsPage toggle → useBusinessPreferencesModel
  → settingsService.updateBusinessPreference("global_dnd", bool)
    → invokeTauri("settings_update_config_bool", { key: "global_dnd", value: bool })
      → Rust config_store: update_envelope_bool → persist_envelope → config.json

读取: config.json → get_config_bool("global_dnd")
  → useBusinessPreferencesModel.globalDnd → SettingsPage 展示
  → notificationDecider 决策时读取
```

### 改动清单

#### 1. Rust — `src-tauri/src/features/settings/data/config_store.rs`
- `Config` struct 增加 `pub global_dnd: bool`
- `legacy_config_to_backend_state` 映射 `global_dnd: config.global_dnd`
- `envelope_value_for_key` 增加 `"global_dnd"` 分支
- `update_envelope_bool` 增加 `"global_dnd"` 分支

#### 2. Rust — `src-tauri/src/features/settings/domain/settings_schema.rs`
- `SettingsBackendStateV1` 增加 `pub global_dnd: bool`

#### 3. 前端 — `src/features/settings/application/settingsService.ts`
- `BusinessPreferenceKey` 增加 `"global_dnd"`
- `BUSINESS_PREFERENCE_KEYS` 增加 `"global_dnd"`
- `BusinessPreferencesSnapshot` 增加 `globalDnd: boolean`
- `readBusinessPreferences` 并行读取覆盖新 key

#### 4. 前端 — `src/features/settings/presentation/composables/useBusinessPreferencesModel.ts`
- `BusinessPreferencesModel` 增加 `globalDnd: Ref<boolean>`
- 增加 `toggleGlobalDnd(next: boolean): Promise<void>`

#### 5. 前端 — `src/features/settings/presentation/composables/useSettingsPageModel.ts`
- `SettingsPageModel` 增加 `globalDnd` 和 `toggleGlobalDnd`

#### 6. 前端 — `src/features/settings/presentation/pages/SettingsPage.vue`
- 在 "business" 区块模板中增加 global_dnd 开关（TDesign t-switch）

#### 7. 通知决策 — `src/features/chat/message-flow/domain/usecases/notificationDecider.ts`
- `decideNotification` 参数增加 `globalDndEnabled: boolean`
- 降级链第一关: `if (globalDndEnabled) return { shouldNotify: false, reason: "global_dnd" }`
- `NotificationDecision.reason` 增加 `"global_dnd"`

#### 8. 调用侧 — `src/app/bootstrap/trayIntegration.ts`
- `createNotificationOnNewMessageHandler` deps 增加 `getGlobalDndEnabled`
- 调用 `decideNotification` 时传入 `globalDndEnabled`

#### 9. i18n — `zh_cn.ts` / `en_us.ts`
- `global_dnd`: "全局免打扰" / "Do Not Disturb"
- `global_dnd_desc`: "开启后所有桌面通知静音" / "Silence all desktop notifications"

---

## Part B — 频道免打扰（频道列表右键菜单）

### 数据流

```
ChannelRail 右键频道条目 → ChannelContextMenu 弹出
  → 用户点击 "静音频道"
    → channelMuteStore.setMuted(channelId, true)
      → ChatNotificationPreferenceApi.setChannelPreference(cid, { mode: "muted" })
        → HTTP PUT /channels/:cid/notification_preference

读取: chat store 初始化时拉取 getPreferences → 缓存到 channelMuteStore
  → ChannelRail 根据 channelMuteStore 显示静音图标
  → trayIntegration 通知决策时读取频道偏好（已有流程）
```

### 改动清单

#### 1. 新增 — `src/features/chat/presentation/patchbay/view-models/useChannelMuteStore.ts`
轻量响应式 store，管理频道静音状态:
- `mutedChannelIds: Ref<Set<string>>` — 已静音频道 id 集合
- `isMuted(channelId): boolean` — 查询
- `toggleMute(channelId): Promise<void>` — 切换（muted ↔ all），乐观更新 + 失败回滚
- `refresh(serverSocket, accessToken): Promise<void>` — 从 API 拉取

#### 2. 新增 — `src/features/chat/presentation/patchbay/interactions/useChannelContextMenu.ts`
参考 `useMessageContextMenu.ts` 模式:
- 右键位置状态（menuOpen, menuX, menuY, menuChannelId）
- `openMenuForChannel(e, channelId)` — 绑定右键事件
- `handleMenuAction(action)` — 分发 mute/unmute/channel_info/mark_read

#### 3. 新增 — `src/features/chat/presentation/patchbay/components/menus/ChannelContextMenu.vue`
右键菜单 UI 组件:
- "频道信息"（已有入口）
- "静音频道 / 取消静音"（根据状态切换）
- "标为已读"

#### 4. 修改 — `src/features/chat/presentation/patchbay/components/layout/ChannelRail.vue`
- 频道条目增加 `@contextmenu.prevent="openChannelMenu($event, c.id)"`
- 引入 `ChannelContextMenu` 组件
- 频道名旁显示静音图标 🔇（`isChannelMuted(c.id)` 时）

#### 5. 修改 — `src/features/chat/presentation/patchbay/view-models/useChannelRailModel.ts`
- `ChannelRailRawModel` 增加 `isChannelMuted` 和 `toggleChannelMute`
- `UseChannelRailModelDeps` 增加 mute store 相关依赖

#### 6. 修改 — `src/features/chat/presentation/patchbay/page/usePatchbayPageModel.ts`
- 装配 `useChannelMuteStore` 并传递给 `useChannelRailModel`
- 在初始化时触发 `refresh()`

#### 7. 扩展 — `src/features/chat/notification-preferences/capability-source.ts`
- `NotificationPreferenceCapabilities` 增加频道 mute 列表和 toggle 能力

#### 8. i18n — `zh_cn.ts` / `en_us.ts`
- `channel_mute`: "静音频道" / "Mute Channel"
- `channel_unmute`: "取消静音" / "Unmute Channel"
- `channel_muted_toast`: "已静音该频道" / "Channel muted"
- `channel_unmuted_toast`: "已取消静音" / "Channel unmuted"
- `channel_mark_read`: "标为已读" / "Mark as Read"

---

## 影响范围汇总

| 层 | 文件数 | 说明 |
|---|---|---|
| Rust backend | 2 | config_store.rs, settings_schema.rs |
| Frontend settings | 5 | settingsService, useBusinessPreferencesModel, useSettingsPageModel, SettingsPage.vue, SettingsTypes |
| Frontend notification | 2 | notificationDecider.ts, trayIntegration.ts |
| Frontend chat (channel mute) | 5 | ChannelRail.vue, useChannelRailModel, usePatchbayPageModel, useChannelContextMenu (new), ChannelContextMenu.vue (new) |
| Frontend mute store | 1 | useChannelMuteStore.ts (new) |
| Frontend notif-pref capability | 1 | capability-source.ts |
| i18n | 2 | zh_cn.ts, en_us.ts |
| **合计** | **~18** | |

## 交互流程

### 全局免打扰
```
SettingsPage → Business 区块
  [全局免打扰] 开关 (默认关闭)
  描述: "开启后所有桌面通知静音"
  
开启后 → notificationDecider 第一关拦截 → 所有通知静音
```

### 频道免打扰
```
用户右键频道 "general"
  ┌──────────────────────┐
  │  频道信息             │  ← 已有
  │  标为已读             │  ← 便利功能
  │ ────────────────     │
  │ 🔇 静音频道           │  ← 未静音状态
  └──────────────────────┘

点击后 → Toast "已静音该频道" → API 持久化 → 频道旁出现 🔇 图标

再次右键:
  ┌──────────────────────┐
  │  频道信息             │
  │  标为已读             │
  │ ────────────────     │
  │ 🔊 取消静音           │  ← 已静音状态
  └──────────────────────┘
```
