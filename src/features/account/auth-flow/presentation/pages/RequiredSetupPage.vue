<script setup lang="ts">
/**
 * @fileoverview RequiredSetupPage.vue
 * @description account/auth-flow｜页面：RequiredSetupPage。
 */

import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { useRequiredSetupModel } from "@/features/account/auth-flow/presentation/composables/useRequiredSetupModel";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

const router = useRouter();
const { t } = useI18n();

const {
  serverSocket,
  serverId,
  plugins,
  requiredEntries,
  missingIdsHint,
  latchClosed,
  justClosedLatch,
  ensureData,
  openPluginCenterRequired,
  switchServer,
  latestVersion,
} = useRequiredSetupModel(router);
</script>

<template>
  <!-- 页面：RequiredSetupPage｜职责：必需插件门禁向导（Power Latch） -->
  <!-- 区块：<main> .cp-required -->
  <main class="cp-required">
    <ErrorBoundary>
      <header class="cp-required__banner" :data-ok="latchClosed" :data-just-closed="justClosedLatch">
        <div class="cp-required__title">
          <span class="cp-required__mono">{{ latchClosed ? t("power_latch_label_closed") : t("power_latch_label_open") }}</span>
          <div class="cp-required__titleZh">{{ latchClosed ? t("power_latch_closed") : t("power_latch_open") }}</div>
        </div>
        <div class="cp-required__desc">
          <div v-if="!latchClosed">
            {{ t("required_setup_desc") }}
          </div>
          <div v-else>
            {{ t("required_setup_ready") }}
          </div>
          <div class="cp-required__socket">
            <MonoTag :value="serverSocket || t('plugins_no_server')" :title="t('server_socket_label')" :copyable="true" />
            <MonoTag :value="serverId || t('plugins_missing_server_id')" :title="t('server_id_label')" :copyable="true" />
            <LabelBadge v-if="!latchClosed" variant="required" :label="t('badge_blocked')" />
            <LabelBadge v-else variant="info" :label="t('badge_ready')" />
          </div>
        </div>
        <div v-if="serverSocket && !serverId" class="cp-required__hint">
          <div class="cp-required__hintTitle">{{ t("required_lock_title") }}</div>
          <div class="cp-required__hintTags">
            <MonoTag :value="t('required_lock_missing_server_id')" />
            <MonoTag :value="t('required_lock_plugins_disabled')" />
          </div>
        </div>
        <div v-if="missingIdsHint.length > 0" class="cp-required__hint">
          <div class="cp-required__hintTitle">{{ t("why_blocked") }}</div>
          <div class="cp-required__hintTags">
            <MonoTag v-for="id in missingIdsHint" :key="id" :value="id" :copyable="true" />
          </div>
        </div>
      </header>

      <section class="cp-required__body">
        <div class="cp-required__bodyHead">
          <div class="cp-required__bodyTitle">{{ t("required_setup_title") }}</div>
          <div class="cp-required__bodyMeta">
            <span class="cp-required__muted">{{ t("required_kv_missing") }}</span>
            <span class="cp-required__mono">{{ plugins.missingRequiredIds.value.length }}</span>
            <span class="cp-required__dot"></span>
            <span class="cp-required__muted">{{ t("required_kv_required") }}</span>
            <span class="cp-required__mono">{{ requiredEntries.length }}</span>
          </div>
        </div>

        <div v-if="plugins.catalogLoading.value" class="cp-required__state">{{ t("loading") }}</div>
        <div v-else-if="plugins.catalogError.value" class="cp-required__state err">{{ plugins.catalogError.value }}</div>
        <div v-else class="cp-required__list">
          <article v-for="p in requiredEntries" :key="p.pluginId" class="cp-required__item" :data-ok="Boolean(plugins.installedById.value[p.pluginId]?.enabled && plugins.installedById.value[p.pluginId]?.status === 'ok')">
            <header class="cp-required__itemHead">
              <div class="cp-required__itemLeft">
                <div class="cp-required__itemName">{{ p.name }}</div>
                <div class="cp-required__itemMeta">
                  <MonoTag :value="p.pluginId" :title="t('server_id_label')" :copyable="true" />
                  <span class="cp-required__mini">{{ latestVersion(p) || "—" }}</span>
                </div>
              </div>
              <div class="cp-required__itemBadges">
                <LabelBadge variant="required" :label="t('badge_required')" />
                <LabelBadge
                  v-if="plugins.installedById.value[p.pluginId]?.status === 'failed'"
                  variant="failed"
                  :label="t('badge_failed')"
                />
                <LabelBadge
                  v-else-if="plugins.installedById.value[p.pluginId]?.enabled"
                  variant="info"
                  :label="t('badge_enabled')"
                />
                <LabelBadge v-else-if="plugins.installedById.value[p.pluginId]?.currentVersion" variant="info" :label="t('badge_installed')" />
                <LabelBadge v-else variant="info" :label="t('badge_missing')" />
              </div>
            </header>

            <div class="cp-required__itemDesc">{{ p.tagline }}</div>
            <div v-if="plugins.installedById.value[p.pluginId]?.lastError" class="cp-required__itemErr">
              {{ plugins.installedById.value[p.pluginId]?.lastError }}
            </div>

            <footer class="cp-required__itemActions">
              <button
                v-if="!plugins.installedById.value[p.pluginId]?.currentVersion"
                class="cp-required__btn primary"
                type="button"
                :disabled="Boolean(serverSocket) && !Boolean(serverId)"
                @click="plugins.install(p, latestVersion(p))"
              >
                {{ t("install") }}
              </button>
              <button
                v-else-if="!plugins.installedById.value[p.pluginId]?.enabled"
                class="cp-required__btn primary"
                type="button"
                :disabled="Boolean(serverSocket) && !Boolean(serverId)"
                @click="plugins.enable(p.pluginId)"
              >
                {{ t("enable") }}
              </button>
              <button
                v-else
                class="cp-required__btn"
                type="button"
                :disabled="Boolean(serverSocket) && !Boolean(serverId)"
                @click="plugins.disable(p.pluginId)"
              >
                {{ t("disable") }}
              </button>

              <button class="cp-required__btn" type="button" @click="$router.push({ path: '/plugins', query: { focus_plugin_id: p.pluginId, filter: 'required' } })">
                {{ t("plugin_center") }}
              </button>
            </footer>
          </article>
        </div>
      </section>

      <footer class="cp-required__footer">
        <button class="cp-required__footerBtn primary" type="button" @click="openPluginCenterRequired">
          {{ t("open_plugin_center_required") }}
        </button>
        <button class="cp-required__footerBtn" type="button" @click="ensureData">{{ t("recheck_required") }}</button>
        <button class="cp-required__footerBtn" type="button" @click="switchServer">{{ t("switch_server") }}</button>
      </footer>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* 样式：RequiredSetupPage｜规格：工作台骨架（banner + body + footer 共享一张玻璃面） */
/* Page wrapper (banner + body + footer) */
.cp-required {
  @include cp-workspace;

  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
}

/* Banner (power latch status)：顶部状态卡 */
.cp-required__banner {
  @include cp-card;

  padding: 12px;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    transform var(--cp-slow) var(--cp-ease);
  animation: cp-latch-alert 380ms ease-out 1;
}

/* Banner variant when latch is closed：就绪状态用 accent 描边 */
.cp-required__banner[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 32%, var(--cp-border));
  animation: none;
}

.cp-required__banner[data-just-closed="true"] {
  animation: cp-latch-close 520ms cubic-bezier(0.22, 1, 0.36, 1) 1;
}

/* Banner mono title：固定英文标签使用统一微标签 */
.cp-required__mono {
  @include cp-section-label;

  color: var(--cp-text);
}

/* Banner Chinese title */
.cp-required__titleZh {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Banner description row */
.cp-required__desc {
  margin-top: 10px;
  color: var(--cp-text);
  font-size: 13px;
  line-height: 1.45;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

/* Hint panel (why blocked / missing server_id)：内嵌弱化卡片 */
.cp-required__hint {
  @include cp-card;

  margin-top: 12px;
  padding: 12px;
  border-style: dashed;
  background: var(--cp-panel-muted);
}

/* Hint title：本地化文案，不做大写变换 */
.cp-required__hintTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text);
}

/* Hint tags list */
.cp-required__hintTags {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Banner socket row */
.cp-required__socket {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Body panel (required list container)：透明内容区域 */
.cp-required__body {
  @include cp-region;

  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Body header */
.cp-required__bodyHead {
  padding: 8px 10px 4px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

/* Body title */
.cp-required__bodyTitle {
  @include cp-section-title;
}

/* Body meta row */
.cp-required__bodyMeta {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

/* Muted label */
.cp-required__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Dot separator */
.cp-required__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--cp-text-light);
}

/* Loading/error state */
.cp-required__state {
  padding: 18px;
  color: var(--cp-text-muted);
  font-size: 13px;
}

/* Error state variant */
.cp-required__state.err {
  color: var(--cp-danger);
}

/* Required items grid */
.cp-required__list {
  padding: 10px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
  min-height: 0;
}

/* Required item card：内嵌卡片 */
.cp-required__item {
  @include cp-card;

  padding: 12px;
}

/* Required item ok variant */
.cp-required__item[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 24%, var(--cp-border));
}

/* Item header row */
.cp-required__itemHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

/* Item name */
.cp-required__itemName {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.02em;
  font-size: 16px;
  color: var(--cp-text);
}

/* Item meta row */
.cp-required__itemMeta {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Item version label */
.cp-required__mini {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Item badges */
.cp-required__itemBadges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

/* Item tagline/description */
.cp-required__itemDesc {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.4;
}

/* Item error box：危险状态条 */
.cp-required__itemErr {
  @include cp-inline-status(danger);

  margin-top: 10px;
  font-size: 12px;
}

/* Item actions row */
.cp-required__itemActions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Item button：胶囊控件 */
.cp-required__btn {
  @include cp-pill-button;
}

/* Item button primary：安装/启用属于“开启”语义，使用 accent */
.cp-required__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 40%, var(--cp-border));
  background: var(--cp-accent-soft);
}

/* Item button primary hover */
.cp-required__btn.primary:hover:enabled {
  border-color: color-mix(in oklab, var(--cp-accent) 58%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 20%, transparent);
}

/* Footer actions row：共享玻璃面上的透明操作区 */
.cp-required__footer {
  @include cp-region;

  padding: 8px 10px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* Footer button */
.cp-required__footerBtn {
  @include cp-pill-button;
}

/* Footer primary：打开插件中心为主操作，使用 highlight */
.cp-required__footerBtn.primary {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

/* Footer primary hover */
.cp-required__footerBtn.primary:hover {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg-strong);
}

@keyframes cp-latch-alert {
  0% {
    transform: translateX(-3px);
  }
  35% {
    transform: translateX(2px);
  }
  70% {
    transform: translateX(-1px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes cp-latch-close {
  0% {
    transform: scale(0.992);
    box-shadow: var(--cp-shadow-soft);
  }
  45% {
    transform: scale(1.008);
    box-shadow: 0 16px 40px var(--cp-accent-shadow);
  }
  100% {
    transform: scale(1);
    box-shadow: var(--cp-shadow-soft);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-required__banner,
  .cp-required__btn,
  .cp-required__footerBtn {
    transition: none !important;
    animation: none !important;
  }
}
</style>
