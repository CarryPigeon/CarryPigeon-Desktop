<script setup lang="ts">
/**
 * @fileoverview 设置页（SettingPage.vue）。
 * @description 设置页（主要用于 UI 预览：主题/运行时信息/本地数据清理）。
 */

import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { getStoredTheme, setTheme, type AppTheme } from "@/shared/utils/theme";
import { USE_MOCK_API } from "@/shared/config/runtime";
import { currentServerSocket, setServerSocket } from "@/features/servers/presentation/store/currentServer";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import { getServerScopeKey, getKnownServerId, forgetServerIdentity } from "@/shared/serverIdentity";
import { removeServerDb } from "@/shared/db";
import { writeAuthSession } from "@/shared/utils/localState";
import { setCurrentUser } from "@/features/user/presentation/store/userData";
import { MOCK_KEYS } from "@/shared/mock/mockKeys";

const router = useRouter();

/**
 * UI 当前展示的主题选择值。
 *
 * 真实来源：
 * - 挂载时通过 `getStoredTheme()` 从 `localStorage` 初始化。
 * - watch 中通过 `setTheme()` 持久化并应用到 DOM。
 */
const theme = ref<AppTheme>("patchbay");

/**
 * 当用户切换分段按钮时持久化主题选择。
 *
 * @param v - 选中的主题。
 */
function handleThemeChange(v: AppTheme): void {
  setTheme(v);
}

watch(theme, handleThemeChange);

/**
 * 组件挂载：从本地持久化初始化主题。
 *
 * @returns void
 */
function handleMounted(): void {
  theme.value = getStoredTheme() ?? "patchbay";
}

onMounted(handleMounted);

/**
 * 从分段按钮选择主题。
 *
 * @param v - 要应用的目标主题。
 */
function pickTheme(v: AppTheme): void {
  theme.value = v;
}

const clearConfirm = ref<string>("");
const clearing = ref<boolean>(false);
const clearError = ref<string>("");

/**
 * 计算“数据清理”面板使用的当前 server socket。
 *
 * @returns socket 字符串。
 */
function computeSocket(): string {
  return currentServerSocket.value.trim();
}

const socket = computed(computeSocket);

/**
 * 计算当前 socket 已知的 server_id。
 *
 * @returns server_id（未知时为空字符串）。
 */
function computeKnownServerId(): string {
  return getKnownServerId(socket.value);
}

const knownServerId = computed(computeKnownServerId);

/**
 * 计算当前持久化 scope key（优先 server_id）。
 *
 * @returns scope key 字符串。
 */
function computeScopeKey(): string {
  return getServerScopeKey(socket.value);
}

const scopeKey = computed(computeScopeKey);

/**
 * 清理当前 server scope 的所有本地数据（破坏性操作）。
 *
 * @returns Promise<void>
 */
async function clearCurrentServerData(): Promise<void> {
  clearError.value = "";
  const s = socket.value;
  if (!s) {
    clearError.value = "Missing server socket.";
    return;
  }
  if (clearConfirm.value.trim().toUpperCase() !== "CLEAR") {
    clearError.value = 'Type "CLEAR" to confirm.';
    return;
  }

  clearing.value = true;
  try {
    // 尽力而为刷新：用于学习 server_id 并触发存储 key 迁移。
    try {
      await useServerInfoStore(s).refresh();
    } catch {
      // 忽略 server-info 刷新失败。
    }

    const scope = getServerScopeKey(s);
    if (!scope) throw new Error("Missing scope key");

    // 清理按 server_id/socket scope 存储的 localStorage 条目。
    localStorage.removeItem(`carrypigeon:authToken:${scope}`);
    localStorage.removeItem(`carrypigeon:authSession:${scope}`);
    localStorage.removeItem(`carrypigeon:lastEventId:${scope}`);
    localStorage.removeItem(`${MOCK_KEYS.pluginsStatePrefix}${s.trim()}`);

    // 清理内存登录态，并返回登录页。
    writeAuthSession(s, null);
    setCurrentUser({ id: "", username: "", email: "", description: "" });
    setServerSocket("");

    // 尽力而为删除 server DB（仅 Tauri 环境有效）。
    try {
      await removeServerDb(s);
    } catch {
      // 在 Web 预览环境下忽略 DB 删除失败。
    }

    // 忘记映射：便于下次连接重新发现。
    forgetServerIdentity(s);

    clearConfirm.value = "";
    void router.replace("/");
  } catch (e) {
    clearError.value = String(e) || "Clear failed.";
  } finally {
    clearing.value = false;
  }
}
</script>

<template>
  <!-- 页面：SettingPage｜职责：设置（主题/开发信息） -->
  <!-- 区块：<main> .cp-settings -->
  <main class="cp-settings">
    <header class="cp-settings__head">
      <button class="cp-settings__back" type="button" @click="router.back()">Back</button>
      <div class="cp-settings__title">
        <div class="cp-settings__name">Settings</div>
        <div class="cp-settings__sub">Theme · Preview switches</div>
      </div>
      <button class="cp-settings__btn" type="button" @click="$router.push('/chat')">Open Patchbay</button>
    </header>

    <section class="cp-settings__grid">
      <div class="cp-settings__card">
        <div class="cp-settings__k">Theme</div>
        <div class="cp-settings__v">
          <div class="cp-settings__seg">
            <button class="cp-settings__segBtn" :data-active="theme === 'patchbay'" type="button" @click="pickTheme('patchbay')">
              Patchbay
            </button>
            <button class="cp-settings__segBtn" :data-active="theme === 'legacy'" type="button" @click="pickTheme('legacy')">
              Legacy
            </button>
          </div>
        </div>
      </div>

      <div class="cp-settings__card">
        <div class="cp-settings__k">Runtime</div>
        <div class="cp-settings__v">
          <div class="cp-settings__row">
            <span class="cp-settings__muted">mock api</span>
            <MonoTag :value="USE_MOCK_API ? 'true' : 'false'" title="VITE_USE_MOCK_API" :copyable="true" />
          </div>
          <div class="cp-settings__hint">
            Use `.env.local` to enable mock mode for local UI preview.
          </div>
        </div>
      </div>

      <div class="cp-settings__card">
        <div class="cp-settings__k">Plugins</div>
        <div class="cp-settings__v">
          <button class="cp-settings__btn" type="button" @click="$router.push('/servers')">Open Server Manager</button>
          <button class="cp-settings__btn" type="button" @click="$router.push('/plugins')">Open Plugin Center</button>
          <button class="cp-settings__btn" type="button" @click="$router.push('/required-setup')">Open Required Setup</button>
        </div>
      </div>

      <div class="cp-settings__card">
        <div class="cp-settings__k">Data</div>
        <div class="cp-settings__v">
          <div class="cp-settings__row">
            <span class="cp-settings__muted">server_socket</span>
            <MonoTag :value="socket || '—'" title="server_socket" :copyable="true" />
          </div>
          <div class="cp-settings__row">
            <span class="cp-settings__muted">known server_id</span>
            <MonoTag :value="knownServerId || '—'" title="server_id" :copyable="true" />
          </div>
          <div class="cp-settings__row">
            <span class="cp-settings__muted">scope key</span>
            <MonoTag :value="scopeKey || '—'" title="scope_key" :copyable="true" />
          </div>

          <div class="cp-settings__hint">
            Clear removes local session/resume data and the per-server local DB (best-effort). It does not affect server-side data.
          </div>

          <div class="cp-settings__clearRow">
            <t-input v-model="clearConfirm" placeholder='Type "CLEAR" to confirm' clearable />
            <button class="cp-settings__danger" type="button" :disabled="clearing" @click="clearCurrentServerData">
              {{ clearing ? "Clearing…" : "Clear Current Server Data" }}
            </button>
          </div>
          <div v-if="clearError" class="cp-settings__err">{{ clearError }}</div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 样式：SettingPage */
/* 选择器：`.cp-settings`｜用途：页面容器（纵向布局） */
.cp-settings {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 选择器：`.cp-settings__head`｜用途：头部卡片（返回/标题/动作） */
.cp-settings__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

/* 选择器：`.cp-settings__back`｜用途：返回按钮 */
.cp-settings__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 选择器：`.cp-settings__back:hover`｜用途：悬停上浮 + 高亮边框 */
.cp-settings__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* 选择器：`.cp-settings__name`｜用途：主标题 */
.cp-settings__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* 选择器：`.cp-settings__sub`｜用途：副标题 */
.cp-settings__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__btn`｜用途：动作按钮（打开页面） */
.cp-settings__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 9px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 选择器：`.cp-settings__btn:hover`｜用途：悬停上浮 + 高亮边框 */
.cp-settings__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* 选择器：`.cp-settings__danger`｜用途：破坏性动作按钮 */
.cp-settings__danger {
  border: 1px solid color-mix(in oklab, var(--cp-danger) 55%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 14%, var(--cp-panel-muted));
  color: var(--cp-text);
  border-radius: 999px;
  padding: 9px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 选择器：`.cp-settings__danger:hover`｜用途：悬停上浮 + 更强 danger 色 */
.cp-settings__danger:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, var(--cp-danger) 18%, var(--cp-panel-muted));
  border-color: color-mix(in oklab, var(--cp-danger) 70%, var(--cp-border));
}

/* 选择器：`.cp-settings__danger:disabled`｜用途：禁用态 */
.cp-settings__danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 选择器：`.cp-settings__grid`｜用途：可滚动卡片网格区域 */
.cp-settings__grid {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

/* 选择器：`.cp-settings__card`｜用途：设置块卡片 */
.cp-settings__card {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
}

/* 选择器：`.cp-settings__k`｜用途：卡片标签（大写） */
.cp-settings__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__v`｜用途：卡片内容容器 */
.cp-settings__v {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 选择器：`.cp-settings__row`｜用途：卡片内 key/value 行 */
.cp-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* 选择器：`.cp-settings__clearRow`｜用途：确认输入 + 破坏性按钮行 */
.cp-settings__clearRow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

/* 选择器：`.cp-settings__err`｜用途：错误提示文本 */
.cp-settings__err {
  font-size: 12px;
  color: var(--cp-danger);
}

/* 选择器：`.cp-settings__seg`｜用途：分段按钮容器 */
.cp-settings__seg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 选择器：`.cp-settings__segBtn`｜用途：分段按钮（未激活） */
.cp-settings__segBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease), color var(--cp-fast) var(--cp-ease);
}

/* 选择器：`.cp-settings__segBtn:hover`｜用途：悬停态 */
.cp-settings__segBtn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

/* 选择器：`.cp-settings__segBtn[data-active="true"]`｜用途：激活态主题按钮 */
.cp-settings__segBtn[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* 选择器：`.cp-settings__row`｜用途：key/value 行布局 */
.cp-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* 选择器：`.cp-settings__muted`｜用途：弱化标签文本 */
.cp-settings__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__hint`｜用途：帮助提示段落 */
.cp-settings__hint {
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.45;
}
</style>
