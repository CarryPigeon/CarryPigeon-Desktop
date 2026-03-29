<script setup lang="ts">
/**
 * @fileoverview 设置页（SettingsPage.vue）。
 * @description 设置页（主题偏好、运行时预览与相关入口）。
 */

import { useRouter } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { IS_MOCK_ENABLED, MOCK_MODE } from "@/shared/config/runtime";
import { useSettingsPageModel } from "@/features/settings/presentation/composables/useSettingsPageModel";

const router = useRouter();
const { theme, themeError, pickTheme } = useSettingsPageModel();
</script>

<template>
  <!-- 页面：SettingsPage｜职责：设置（主题/开发信息） -->
  <!-- 区块：<main> .cp-settings -->
  <main class="cp-settings">
    <header class="cp-settings__head">
      <button class="cp-settings__back" type="button" @click="router.back()">Back</button>
      <div class="cp-settings__title">
        <div class="cp-settings__name">Settings</div>
        <div class="cp-settings__sub">Theme · Preview switches</div>
      </div>
      <button class="cp-settings__btn" type="button" @click="router.push('/chat')">Open Patchbay</button>
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
          <div v-if="themeError" class="cp-settings__err">{{ themeError }}</div>
        </div>
      </div>

      <div class="cp-settings__card">
        <div class="cp-settings__k">Runtime</div>
        <div class="cp-settings__v">
          <div class="cp-settings__row">
            <span class="cp-settings__muted">mock api</span>
            <MonoTag :value="IS_MOCK_ENABLED ? 'true' : 'false'" title="VITE_USE_MOCK_API" :copyable="true" />
          </div>
          <div class="cp-settings__row">
            <span class="cp-settings__muted">mock mode</span>
            <MonoTag :value="MOCK_MODE" title="VITE_MOCK_MODE" :copyable="true" />
          </div>
          <div class="cp-settings__hint">
            Use `.env.local` to enable mock mode for local UI preview.
          </div>
        </div>
      </div>

      <div class="cp-settings__card">
        <div class="cp-settings__k">Entrypoints</div>
        <div class="cp-settings__v">
          <button class="cp-settings__btn" type="button" @click="router.push('/servers')">Open Server Manager</button>
          <button class="cp-settings__btn" type="button" @click="router.push('/plugins')">Open Plugin Center</button>
          <button class="cp-settings__btn" type="button" @click="router.push('/required-setup')">Open Required Setup</button>
        </div>
      </div>

    </section>
  </main>
</template>

<style scoped lang="scss">
/* 样式：SettingsPage */
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
