<script setup lang="ts">
/**
 * @fileoverview 设置页（SettingsPage.vue）。
 * @description 设置页（主题偏好、运行时预览与相关入口）。
 */

import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { IS_MOCK_ENABLED, MOCK_MODE } from "@/shared/config/runtime";
import {
  getStoredDiagnosticsEnabled,
  setDiagnosticsEnabled,
} from "@/shared/config/performance";
import { getAboutCapabilities } from "@/features/about/api";
import type { AppInfo } from "@/features/about/api-types";
import { checkForUpdate, type UpdateStatus } from "@/shared/updater/checkUpdate";
import { useSettingsPageModel } from "@/features/settings/presentation/composables/useSettingsPageModel";
import { usePluginSettings } from "@/features/settings/presentation/composables/usePluginSettings";
import { DEFAULT_APP_THEME, type AppAccent, type AppThemePreference } from "@/features/settings/domain/types/SettingsTypes";
import { DEFAULT_APP_LOCALE } from "@/shared/utils/locale";
import {
  exportSettingsEnvelope,
  importSettingsEnvelope,
  resetSettingsEnvelope,
} from "@/features/settings/application/settingsService";
import type { SettingsSchemaEnvelopeV1 } from "@/features/settings/api-types";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';
import PageHeader from '@/shared/ui/PageHeader.vue';
import DiagnosticsPanel from "@/features/settings/presentation/components/DiagnosticsPanel.vue";
import { AiProviderSettings } from "@/features/ai/components";
import {
  SETTINGS_CATALOG,
  SETTINGS_PLUGINS_SECTION_ID,
  SETTINGS_SECTIONS,
  findSettingsAnchor,
  settingsPluginItemAnchor,
  settingsSectionAnchorId,
  type SettingsSectionId,
} from "@/features/settings/presentation/settingsCatalog";
import {
  buildSettingsSearchEntries,
  filterSettingsSearchEntries,
  normalizeSettingsSearchQuery,
  type SettingsSearchEntry,
} from "@/features/settings/presentation/settingsSearch";
import AppIcon from "@/shared/ui/AppIcon.vue";

const router = useRouter();
const { t } = useI18n();
const isDev = import.meta.env.DEV;
const {
  theme,
  themeError,
  pickTheme,
  accent,
  accentError,
  pickAccent,
  language,
  preferencesError,
  autoLogin,
  autoLaunch,
  closeToTray,
  checkForUpdates,
  emailNotifications,
  desktopNotifications,
  globalDnd,
  notificationSound,
  selectLanguage,
  toggleAutoLogin,
  toggleAutoLaunch,
  toggleCloseToTray,
  toggleCheckForUpdates,
  refreshGeneralPreferences,
  refreshBusinessPreferences,
  toggleEmailNotifications,
  toggleDesktopNotifications,
  toggleGlobalDnd,
  toggleNotificationSound,
  businessPreferencesError,
} = useSettingsPageModel();

// 插件设置项（当前 server）：用于「插件设置」分区渲染与搜索索引。
const {
  items: pluginSettingsItems,
  groups: pluginSettingsGroups,
  ensureLoaded: ensurePluginSettingsLoaded,
} = usePluginSettings();

// 应用信息（「关于」分区数据源）；在 navSections 之前声明：该 Tab 需按数据就绪出现。
const appInfo = ref<AppInfo | null>(null);

// 分区导航/内容区顺序与文案来自 settingsCatalog（单一真源）；
// 「插件设置」无插件设置项、「关于」未取得应用信息时不出现，保证每个导航项都有已渲染面板。
const navSections = computed(() =>
  SETTINGS_SECTIONS.filter((section) => {
    if (section.id === SETTINGS_PLUGINS_SECTION_ID) return pluginSettingsGroups.value.length > 0;
    if (section.id === "about") return appInfo.value !== null;
    return true;
  }),
);

const sectionNav = computed(() =>
  navSections.value.map((section) => ({
    id: section.id,
    label: t(section.labelKey),
    subtitle: t(section.subtitleKey),
  })),
);

const activeSectionId = ref<SettingsSectionId>("general");
const settingsSectionsRef = ref<HTMLElement | null>(null);

/**
 * 切换右侧分区面板（Tab 语义：一次只显示一个分区），并把面板滚动条复位到顶部。
 *
 * @param sectionId - 目标分区 id。
 */
async function setActiveSection(sectionId: SettingsSectionId): Promise<void> {
  activeSectionId.value = sectionId;
  await nextTick();
  const container = settingsSectionsRef.value;
  if (container) container.scrollTop = 0;
}

// 搜索：查询非空时用结果列表替换左栏导航（清空后恢复导航）。
const searchQuery = ref("");
const normalizedSearchQuery = computed(() => normalizeSettingsSearchQuery(searchQuery.value));
const searchActive = computed(() => normalizedSearchQuery.value.length > 0);
const activeResultIndex = ref(0);

// 搜索索引 = 内置设置项索引 + 插件注册的设置项（标题/说明已本地化）。
const searchEntries = computed(() =>
  buildSettingsSearchEntries({
    catalog: SETTINGS_CATALOG,
    pluginItems: pluginSettingsItems.value,
    sections: SETTINGS_SECTIONS,
    translate: (key) => t(key),
  }),
);

const searchResults = computed(() =>
  filterSettingsSearchEntries(searchEntries.value, searchQuery.value),
);

let flashTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 给跳转目标加一次性高亮（outline 不影响布局；scoped 样式对页面内元素有效）。
 *
 * @param el - 目标元素。
 */
function flashSettingItem(el: HTMLElement): void {
  if (flashTimer) clearTimeout(flashTimer);
  el.classList.add("cp-settings__flash");
  flashTimer = setTimeout(() => {
    el.classList.remove("cp-settings__flash");
    flashTimer = null;
  }, 1200);
}

/**
 * 跳转到某个搜索结果：先把右栏切到该条目所属分区（Tab），再在面板内滚动 + 高亮。
 *
 * @param entry - 目标条目。
 * @param index - 结果序号（用于同步键盘高亮；缺省不改）。
 */
async function jumpToResult(entry: SettingsSearchEntry, index = -1): Promise<void> {
  if (index >= 0) activeResultIndex.value = index;
  await setActiveSection(entry.sectionId);
  const target =
    findSettingsAnchor(entry.anchor) ??
    document.getElementById(settingsSectionAnchorId(entry.sectionId));
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  flashSettingItem(target);
}

/** 键盘移动搜索结果高亮（循环）。 */
function moveActiveResult(delta: number): void {
  const total = searchResults.value.length;
  if (total === 0) return;
  activeResultIndex.value = (activeResultIndex.value + delta + total) % total;
}

/** 回车跳转到当前高亮结果（无高亮时取第一条）。 */
async function jumpToActiveResult(): Promise<void> {
  const index = Math.min(activeResultIndex.value, searchResults.value.length - 1);
  const entry = searchResults.value[index] ?? searchResults.value[0];
  if (entry) await jumpToResult(entry, Math.max(index, 0));
}

function clearSearch(): void {
  searchQuery.value = "";
  activeResultIndex.value = 0;
}

watch(normalizedSearchQuery, () => {
  activeResultIndex.value = 0;
});

// 分区集合变化（「插件设置」/「关于」异步出现或消失）时校正当前 Tab，避免右栏空白。
watch(
  () => navSections.value.map((section) => section.id).join(","),
  () => {
    if (navSections.value.some((section) => section.id === activeSectionId.value)) return;
    void setActiveSection(navSections.value[0]?.id ?? "general");
  },
);

onMounted(() => {
  ensurePluginSettingsLoaded();
});

onBeforeUnmount(() => {
  if (flashTimer) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
});

const updateCheckState = ref<UpdateStatus | { kind: 'checking' }>({ kind: 'checking' });
const diagnosticsMode = ref(false);
const diagnosticsVisible = ref(false);

function toggleDiagnosticsMode(next: boolean): void {
  setDiagnosticsEnabled(next);
  diagnosticsMode.value = getStoredDiagnosticsEnabled();
}

onMounted(() => {
  diagnosticsMode.value = getStoredDiagnosticsEnabled();
});

async function handleCheckUpdate(): Promise<void> {
  updateCheckState.value = { kind: 'checking' };
  updateCheckState.value = await checkForUpdate();
}

onMounted(async () => {
  appInfo.value = await getAboutCapabilities().getAppInfo();
});
const importFileInput = ref<HTMLInputElement | null>(null);
const dataStatus = ref<{ tone: "success" | "danger"; message: string } | null>(null);

// 选择器：`.cp-settings__errBanner` 数据源｜用途：聚合各偏好加载错误，仅在出错时展示
const settingsError = computed(
  () => themeError.value || preferencesError.value || businessPreferencesError.value,
);

function setDataStatus(tone: "success" | "danger", message: string): void {
  dataStatus.value = { tone, message };
}

function clearDataStatus(): void {
  dataStatus.value = null;
}

function normalizeImportTheme(raw: unknown): AppThemePreference | null {
  // 兼容旧版本导出中的主题值：patchbay（品牌暗色）→ dark；legacy（经典浅色）→ light。
  if (raw === "system" || raw === "dark" || raw === "light") return raw;
  if (raw === "patchbay") return "dark";
  if (raw === "legacy") return "light";
  return null;
}

function normalizeImportAccent(raw: unknown): AppAccent | null {
  return raw === "default" || raw === "patchbay" ? raw : null;
}

function triggerImportDialog(): void {
  importFileInput.value?.click();
}

async function handleExportSettings(): Promise<void> {
  clearDataStatus();
  try {
    const payload = await exportSettingsEnvelope();
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `settings-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setDataStatus("success", t("settings_export_downloaded"));
  } catch (error) {
    setDataStatus("danger", String(error) || t("settings_export_failed"));
  }
}

async function handleImportFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  clearDataStatus();
  try {
    const raw = await file.text();
    await importSettingsEnvelope(raw);

    const parsed = JSON.parse(raw) as SettingsSchemaEnvelopeV1;
    const importedTheme = normalizeImportTheme(parsed?.localCache?.theme);
    if (importedTheme) {
      const currentTheme = theme.value;
      if (currentTheme !== importedTheme) {
        pickTheme(importedTheme);
      }
    }

    const importedAccent = normalizeImportAccent(parsed?.localCache?.accent);
    if (importedAccent) {
      const currentAccent = accent.value;
      if (currentAccent !== importedAccent) {
        pickAccent(importedAccent);
      }
    }

    await refreshGeneralPreferences();
    await refreshBusinessPreferences();
    setDataStatus("success", t("settings_imported_applied"));
  } catch (error) {
    setDataStatus("danger", String(error) || t("settings_import_failed"));
  }
}

async function handleResetDefaults(): Promise<void> {
  clearDataStatus();
  try {
    await resetSettingsEnvelope();
    selectLanguage(DEFAULT_APP_LOCALE);
    if (theme.value !== DEFAULT_APP_THEME) {
      pickTheme(DEFAULT_APP_THEME);
    }
    await refreshGeneralPreferences();
    await refreshBusinessPreferences();
    setDataStatus("success", t("settings_reset_done"));
  } catch (error) {
    setDataStatus("danger", String(error) || t("settings_reset_failed"));
  }
}
</script>

<template>
  <!-- 页面：SettingsPage｜职责：设置中心 shell（general / business / data） -->
  <!-- 区块：<main> .cp-settings -->
  <main class="cp-settings">
    <ErrorBoundary>
      <PageHeader
        :title="t('settings_title')"
        :subtitle="t('settings_subtitle')"
        back
        data-testid="settings-header"
        @back="router.back()"
      />

      <div v-if="settingsError" class="cp-settings__errBanner" role="alert">{{ settingsError }}</div>

      <!-- 区块：`.cp-settings__layout`｜用途：左右布局容器（左侧纵向 Tab 导航 + 右侧当前分区面板） -->
      <div class="cp-settings__layout">
        <aside class="cp-settings__navWrap">
          <div class="cp-settings__rail">
            <!-- 区块：设置搜索｜用途：按标题/说明/关键词/分区名搜索内置与插件设置项 -->
            <div class="cp-settings__search" role="search">
              <svg
                class="cp-settings__searchIcon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.6-3.6" />
              </svg>
              <input
                v-model="searchQuery"
                class="cp-settings__searchInput"
                type="text"
                role="searchbox"
                data-testid="settings-search-input"
                :aria-label="t('settings_search_placeholder')"
                :placeholder="t('settings_search_placeholder')"
                :aria-controls="searchActive ? 'settings-search-results' : undefined"
                @keydown.down.prevent="moveActiveResult(1)"
                @keydown.up.prevent="moveActiveResult(-1)"
                @keydown.enter.prevent="jumpToActiveResult()"
                @keydown.esc.prevent="clearSearch()"
              />
              <button
                v-if="searchActive"
                class="cp-settings__searchClear"
                data-testid="settings-search-clear"
                type="button"
                :aria-label="t('settings_search_clear')"
                :title="t('settings_search_clear')"
                @click="clearSearch()"
              >
                <AppIcon name="close" />
              </button>
            </div>

            <!-- 区块：搜索结果｜用途：查询非空时替换分区导航 -->
            <div
              v-if="searchActive"
              id="settings-search-results"
              class="cp-settings__results"
              role="listbox"
              data-testid="settings-search-results"
              :aria-label="t('settings_search_placeholder')"
            >
              <div class="cp-settings__resultsHead">
                {{ t("settings_search_count", { n: searchResults.length }) }}
              </div>
              <div v-if="searchResults.length === 0" class="cp-settings__resultsEmpty">
                {{ t("settings_search_empty") }}
              </div>
              <button
                v-for="(entry, index) in searchResults"
                :key="entry.anchor"
                class="cp-settings__result"
                type="button"
                role="option"
                :id="`settings-search-option-${index}`"
                :data-active="index === activeResultIndex"
                :aria-selected="index === activeResultIndex"
                :data-testid="`settings-search-result-${entry.anchor}`"
                @mousemove="activeResultIndex = index"
                @click="jumpToResult(entry, index)"
              >
                <span class="cp-settings__resultTitle">{{ entry.title }}</span>
                <span class="cp-settings__resultMeta">
                  {{ entry.sectionLabel }}
                  <template v-if="entry.sourceLabel">· {{ entry.sourceLabel }}</template>
                </span>
              </button>
            </div>

            <nav
              v-else
              class="cp-settings__nav"
              role="tablist"
              aria-orientation="vertical"
              :aria-label="t('settings_sections')"
            >
              <button
                v-for="section in sectionNav"
                :key="section.id"
                :id="`settings-nav-${section.id}`"
                class="cp-settings__navBtn"
                role="tab"
                :aria-selected="activeSectionId === section.id"
                :aria-controls="settingsSectionAnchorId(section.id)"
                :data-active="activeSectionId === section.id"
                :data-testid="`settings-nav-${section.id}`"
                type="button"
                @click="setActiveSection(section.id)"
              >
                <span class="cp-settings__navLabel">{{ section.label }}</span>
                <span class="cp-settings__navSub">{{ section.subtitle }}</span>
              </button>
            </nav>
          </div>
        </aside>

      <section ref="settingsSectionsRef" class="cp-settings__sections">
        <section
          id="settings-section-general"
          v-show="activeSectionId === 'general'"
          class="cp-settings__section"
          role="tabpanel"
          aria-labelledby="settings-nav-general"
          data-testid="settings-section-general"
        >
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_general_preferences") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_general_preferences_sub") }}</div>
            </div>
          </header>

          <div v-if="preferencesError" class="cp-settings__err">{{ preferencesError }}</div>

          <div class="cp-settings__grid">
            <div class="cp-settings__card" data-settings-item="general-theme">
              <div class="cp-settings__k">{{ t("settings_theme") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__seg">
                  <button
                    class="cp-settings__segBtn"
                    :data-active="theme === 'system'"
                    data-testid="settings-theme-system"
                    type="button"
                    @click="pickTheme('system')"
                  >
                    {{ t("settings_theme_system") }}
                  </button>
                  <button
                    class="cp-settings__segBtn"
                    :data-active="theme === 'dark'"
                    data-testid="settings-theme-dark"
                    type="button"
                    @click="pickTheme('dark')"
                  >
                    {{ t("settings_theme_dark") }}
                  </button>
                  <button
                    class="cp-settings__segBtn"
                    :data-active="theme === 'light'"
                    data-testid="settings-theme-light"
                    type="button"
                    @click="pickTheme('light')"
                  >
                    {{ t("settings_theme_light") }}
                  </button>
                </div>
                <div v-if="themeError" class="cp-settings__err">{{ themeError }}</div>
              </div>
            </div>

            <div class="cp-settings__card" data-settings-item="general-accent">
              <div class="cp-settings__k">{{ t("settings_accent") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__seg">
                  <button
                    class="cp-settings__segBtn"
                    :data-active="accent === 'default'"
                    data-testid="settings-accent-default"
                    type="button"
                    @click="pickAccent('default')"
                  >
                    {{ t("settings_accent_default") }}
                  </button>
                  <button
                    class="cp-settings__segBtn"
                    :data-active="accent === 'patchbay'"
                    data-testid="settings-accent-patchbay"
                    type="button"
                    @click="pickAccent('patchbay')"
                  >
                    {{ t("settings_accent_patchbay") }}
                  </button>
                </div>
                <div class="cp-settings__hint">{{ t("settings_accent_hint") }}</div>
                <div v-if="accentError" class="cp-settings__err">{{ accentError }}</div>
              </div>
            </div>

            <div class="cp-settings__card" data-settings-item="general-language">
              <div class="cp-settings__k">{{ t("settings_language") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__seg">
                  <button
                    class="cp-settings__segBtn"
                    :data-active="language === 'zh_cn'"
                    data-testid="settings-language-zh_cn"
                    type="button"
                    @click="selectLanguage('zh_cn')"
                  >
                    简体中文
                  </button>
                  <button
                    class="cp-settings__segBtn"
                    :data-active="language === 'en_us'"
                    data-testid="settings-language-en_us"
                    type="button"
                    @click="selectLanguage('en_us')"
                  >
                    English
                  </button>
                </div>
                <div class="cp-settings__hint">{{ t("settings_language_hint") }}</div>
              </div>
            </div>

            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("settings_startup") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__row" data-settings-item="general-auto-login">
                  <span class="cp-settings__muted">{{ t("auto_login") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-auto-login" :data-active="autoLogin" type="button" @click="toggleAutoLogin(!autoLogin)">
                    {{ autoLogin ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row" data-settings-item="general-auto-launch">
                  <span class="cp-settings__muted">{{ t("settings_auto_launch") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-auto-launch" :data-active="autoLaunch" type="button" @click="toggleAutoLaunch(!autoLaunch)">
                    {{ autoLaunch ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__hint">{{ t("settings_startup_hint") }}</div>
              </div>
            </div>

            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("notifications") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__row" data-settings-item="general-close-to-tray">
                  <span class="cp-settings__muted">{{ t("close_to_tray") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-close-to-tray" :data-active="closeToTray" type="button" @click="toggleCloseToTray(!closeToTray)">
                    {{ closeToTray ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row" data-settings-item="general-check-for-updates">
                  <span class="cp-settings__muted">{{ t("check_for_updates") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-check-for-updates" :data-active="checkForUpdates" type="button" @click="toggleCheckForUpdates(!checkForUpdates)">
                    {{ checkForUpdates ? t("enabled") : t("disabled") }}
                  </button>
                </div>
              </div>
            </div>

            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("settings_runtime") }}</div>
              <div class="cp-settings__v">
                <template v-if="isDev">
                  <div class="cp-settings__row">
                    <span class="cp-settings__muted">{{ t("settings_mock_api") }}</span>
                    <MonoTag :value="IS_MOCK_ENABLED ? 'true' : 'false'" title="VITE_USE_MOCK_API" :copyable="true" />
                  </div>
                  <div class="cp-settings__row">
                    <span class="cp-settings__muted">{{ t("settings_mock_mode") }}</span>
                    <MonoTag :value="MOCK_MODE" title="VITE_MOCK_MODE" :copyable="true" />
                  </div>
                </template>
                <div class="cp-settings__row" data-settings-item="general-diagnostics-mode">
                  <span class="cp-settings__muted">{{ t("settings_diagnostics_mode") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-diagnostics-mode" :data-active="diagnosticsMode" type="button" @click="toggleDiagnosticsMode(!diagnosticsMode)">
                    {{ diagnosticsMode ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__hint">{{ t("settings_diagnostics_mode_desc") }}</div>
                <div class="cp-settings__row" data-settings-item="general-diagnostics-panel">
                  <span class="cp-settings__muted">{{ t("diagnostics_panel_title") }}</span>
                  <button
                    class="cp-settings__segBtn"
                    type="button"
                    :disabled="!diagnosticsMode && !isDev"
                    @click="diagnosticsVisible = true"
                  >
                    {{ t("diagnostics_open_panel") }}
                  </button>
                </div>
                <div class="cp-settings__hint">{{ t("settings_runtime_hint") }}</div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="settings-section-business"
          v-show="activeSectionId === 'business'"
          class="cp-settings__section"
          role="tabpanel"
          aria-labelledby="settings-nav-business"
          data-testid="settings-section-business"
        >
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_business_settings") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_business_settings_sub") }}</div>
            </div>
          </header>

          <div class="cp-settings__grid">
            <div class="cp-settings__card wide">
              <div class="cp-settings__k">{{ t("settings_feature_settings") }}</div>
              <div v-if="businessPreferencesError" class="cp-settings__err">{{ businessPreferencesError }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__row" data-settings-item="business-email-notifications">
                  <span class="cp-settings__muted">{{ t("email_notifications") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-email-notifications" :data-active="emailNotifications" type="button" @click="toggleEmailNotifications(!emailNotifications)">
                    {{ emailNotifications ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row" data-settings-item="business-desktop-notifications">
                  <span class="cp-settings__muted">{{ t("desktop_notifications") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-desktop-notifications" :data-active="desktopNotifications" type="button" @click="toggleDesktopNotifications(!desktopNotifications)">
                    {{ desktopNotifications ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row" data-settings-item="business-global-dnd">
                  <span class="cp-settings__muted">{{ t("global_dnd") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-global-dnd" :data-active="globalDnd" type="button" @click="toggleGlobalDnd(!globalDnd)">
                    {{ globalDnd ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__hint">{{ t("global_dnd_desc") }}</div>
                <div class="cp-settings__row" data-settings-item="business-notification-sound">
                  <span class="cp-settings__muted">{{ t("notification_sound") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-notification-sound" :data-active="notificationSound" type="button" @click="toggleNotificationSound(!notificationSound)">
                    {{ notificationSound ? t("enabled") : t("disabled") }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="settings-section-ai"
          v-show="activeSectionId === 'ai'"
          class="cp-settings__section"
          role="tabpanel"
          aria-labelledby="settings-nav-ai"
          data-testid="settings-section-ai"
        >
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_ai_service") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_ai_service_sub") }}</div>
            </div>
          </header>

          <div class="cp-settings__grid">
            <div class="cp-settings__card wide" data-settings-item="ai-provider">
              <ErrorBoundary>
                <AiProviderSettings />
              </ErrorBoundary>
            </div>
          </div>
        </section>

        <section
          id="settings-section-data"
          v-show="activeSectionId === 'data'"
          class="cp-settings__section"
          role="tabpanel"
          aria-labelledby="settings-nav-data"
          data-testid="settings-section-data"
        >
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_data_management") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_data_management_sub") }}</div>
            </div>
          </header>

          <div class="cp-settings__grid">
            <div class="cp-settings__card" data-settings-item="data-import-export">
              <div class="cp-settings__k">{{ t("settings_import_export_reset") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__hint">{{ t("settings_import_export_hint") }}</div>
                <div v-if="dataStatus" class="cp-settings__statusInline" :data-tone="dataStatus.tone">{{ dataStatus.message }}</div>
                <div class="cp-settings__rowWrap">
                  <button class="cp-settings__btn" data-testid="settings-export" type="button" @click="handleExportSettings">{{ t("settings_export") }}</button>
                  <button class="cp-settings__btn" data-testid="settings-import" type="button" @click="triggerImportDialog">{{ t("settings_import") }}</button>
                  <button class="cp-settings__btn" data-testid="settings-reset-defaults" type="button" @click="handleResetDefaults">{{ t("settings_reset_defaults") }}</button>
                </div>
                <input ref="importFileInput" class="cp-settings__hiddenInput" type="file" accept="application/json,.json" @change="handleImportFileChange" />
              </div>
            </div>

            <div class="cp-settings__card" data-settings-item="data-entrypoints">
              <div class="cp-settings__k">{{ t("settings_entrypoints") }}</div>
              <div class="cp-settings__v">
                <button class="cp-settings__btn" data-testid="settings-open-server-manager" type="button" @click="router.push('/servers')">
                  {{ t("settings_open_server_manager") }}
                </button>
                <button class="cp-settings__btn" data-testid="settings-open-plugin-center" type="button" @click="router.push('/plugins')">
                  {{ t("settings_open_plugin_center") }}
                </button>
                <button class="cp-settings__btn" data-testid="settings-open-required-setup" type="button" @click="router.push('/required-setup')">
                  {{ t("settings_open_required_setup") }}
                </button>
                <button class="cp-settings__btn" data-testid="settings-open-file-manager" type="button" @click="router.push('/files')">
                  {{ t("file_manager") }}
                </button>
                <button class="cp-settings__btn" data-testid="settings-open-emoji-manage" type="button" @click="router.push('/settings/emoji')">
                  {{ t("manage_emojis") }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 区块：插件设置｜用途：插件通过 ctx.ui.registerSettingsItem 注册的设置项（无项时不渲染） -->
        <section
          v-if="pluginSettingsGroups.length > 0"
          id="settings-section-plugins"
          v-show="activeSectionId === 'plugins'"
          class="cp-settings__section"
          role="tabpanel"
          aria-labelledby="settings-nav-plugins"
          data-testid="settings-section-plugins"
        >
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_plugins_section") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_plugins_section_sub") }}</div>
            </div>
          </header>

          <div class="cp-settings__grid">
            <div v-for="group in pluginSettingsGroups" :key="group.pluginId" class="cp-settings__card wide">
              <div class="cp-settings__k">{{ t("settings_plugin_source", { id: group.pluginId }) }}</div>
              <div class="cp-settings__v">
                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="cp-settings__pluginItem"
                  :data-settings-item="settingsPluginItemAnchor(item.pluginId, item.id)"
                  :data-testid="`settings-plugin-item-${item.pluginId}-${item.id}`"
                >
                  <div class="cp-settings__pluginHead">
                    <span class="cp-settings__pluginTitle">{{ item.title }}</span>
                  </div>
                  <div v-if="item.description" class="cp-settings__hint">{{ item.description }}</div>
                  <!-- 单个插件控件抛错只降级该项，不影响其余设置 -->
                  <ErrorBoundary>
                    <component :is="item.component" />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="appInfo"
          id="settings-section-about"
          v-show="activeSectionId === 'about'"
          class="cp-settings__section"
          role="tabpanel"
          aria-labelledby="settings-nav-about"
          data-testid="settings-section-about"
        >
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("menu_about") }}</div>
              <div class="cp-settings__sectionSub">{{ t("about_version") }} {{ appInfo.version }}</div>
            </div>
          </header>
          <div class="cp-settings__grid">
            <div class="cp-settings__card" data-settings-item="about-version">
              <div class="cp-settings__k">{{ t("about_version") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ appInfo.name }}</span>
                  <MonoTag :value="appInfo.version" title="version" />
                </div>
              </div>
            </div>
            <div class="cp-settings__card" data-settings-item="about-check-updates">
              <div class="cp-settings__k">{{ t("check_for_updates") }}</div>
              <div class="cp-settings__v">
                <button class="cp-settings__btn" data-testid="settings-check-update-now" type="button" @click="handleCheckUpdate" :disabled="updateCheckState.kind === 'checking'">
                  {{ updateCheckState.kind === 'checking' ? t('checking') : t('check_for_updates') }}
                </button>
                <div v-if="updateCheckState.kind === 'up_to_date'" class="cp-settings__hint">{{ t('settings_up_to_date') }}</div>
                <div v-else-if="updateCheckState.kind === 'update_available'" class="cp-settings__hint">
                  {{ t('settings_update_available') }} v{{ updateCheckState.version }}
                  <a :href="updateCheckState.releaseUrl" target="_blank" class="cp-settings__link" rel="noopener noreferrer">{{ t('updater_download_page') }}</a>
                </div>
                <div v-else-if="updateCheckState.kind === 'error'" class="cp-settings__err">{{ updateCheckState.message }}</div>
              </div>
            </div>
            <div class="cp-settings__card" data-settings-item="about-tech-stack">
              <div class="cp-settings__k">{{ t("about_tech_stack") }}</div>
              <div class="cp-settings__v">
                <div v-for="item in appInfo.techStack" :key="item" class="cp-settings__row">
                  <span class="cp-settings__muted">{{ item }}</span>
                </div>
              </div>
            </div>
            <div class="cp-settings__card" data-settings-item="about-license">
              <div class="cp-settings__k">{{ t("about_license") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ appInfo.license }}</span>
                </div>
              </div>
            </div>
            <div class="cp-settings__card" data-settings-item="about-credits">
              <div class="cp-settings__k">{{ t("about_credits") }}</div>
              <div class="cp-settings__v">
                <div v-for="credit in appInfo.credits" :key="credit.name" class="cp-settings__row">
                  <a v-if="credit.url" :href="credit.url" target="_blank" rel="noopener" class="cp-settings__link">{{ credit.name }}</a>
                  <span v-else class="cp-settings__muted">{{ credit.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
      </div>
    </ErrorBoundary>

    <t-dialog
      v-model:visible="diagnosticsVisible"
      :header="t('diagnostics_panel_title')"
      width="720px"
      :footer="false"
      destroy-on-close
    >
      <DiagnosticsPanel />
    </t-dialog>
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

/* 选择器：`.cp-settings__btn`｜用途：动作按钮（打开页面） */
.cp-settings__btn {
  @include button-size('md');
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 选择器：`.cp-settings__btn:hover`｜用途：悬停上浮 + 高亮边框 */
.cp-settings__btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-settings__btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.cp-settings__btn--danger {
  border-color: color-mix(in oklab, var(--cp-danger) 40%, var(--cp-border));
  color: var(--cp-danger);
}

.cp-settings__btn--danger:hover:not(:disabled) {
  border-color: var(--cp-danger);
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-hover-bg));
}

/* 选择器：`.cp-settings__errBanner`｜用途：全局错误提示条（仅出错时渲染） */
.cp-settings__errBanner {
  border: 1px solid color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--cp-danger);
}

/* 选择器：`.cp-settings__layout`｜用途：左右布局容器（左侧导航 + 右侧内容），窄窗口回退纵向 */
.cp-settings__layout {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}

/* 选择器：`.cp-settings__navWrap`｜用途：左侧固定宽纵向导航侧栏 */
.cp-settings__navWrap {
  flex: 0 0 auto;
  width: 240px;
  overflow: auto;
  display: flex;
}

/* 选择器：`.cp-settings__rail`｜用途：左栏面板容器（搜索框固定在上，导航/结果列表滚动） */
.cp-settings__rail {
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 10px;
  padding: 10px;
  min-height: 0;
}

/* 选择器：`.cp-settings__search`｜用途：设置搜索输入框容器（与设置页面板风格一致） */
.cp-settings__search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 14px;
  padding: 8px 10px;
  transition: border-color var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-settings__search:focus-within {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-hover-bg);
}

.cp-settings__searchIcon {
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__searchInput`｜用途：原生搜索输入（无边框，融入面板底色） */
.cp-settings__searchInput {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  font-size: 12px;
  line-height: 1.4;
  outline: none;
}

.cp-settings__searchInput::placeholder {
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__searchClear`｜用途：清空搜索按钮 */
.cp-settings__searchClear {
  border: 0;
  background: transparent;
  color: var(--cp-text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 999px;
  transition: color var(--cp-fast) var(--cp-ease);
}

.cp-settings__searchClear:hover {
  color: var(--cp-text);
}

/* 选择器：`.cp-settings__results`｜用途：搜索结果列表（查询非空时替换导航） */
.cp-settings__results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--cp-panel-muted);
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-settings__resultsHead {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
  padding: 2px 4px;
}

.cp-settings__resultsEmpty {
  font-size: 12px;
  color: var(--cp-text-muted);
  padding: 6px 4px;
  line-height: 1.45;
}

/* 选择器：`.cp-settings__result`｜用途：搜索结果行（键盘/鼠标高亮） */
.cp-settings__result {
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text);
  border-radius: 12px;
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  transition: background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-settings__result:hover,
.cp-settings__result[data-active="true"] {
  background: var(--cp-highlight-bg);
  border-color: var(--cp-highlight-border-strong);
}

.cp-settings__resultTitle {
  font-size: 12px;
  color: var(--cp-text);
}

.cp-settings__resultMeta {
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__flash`｜用途：搜索结果跳转后的一次性高亮（outline 不影响布局） */
.cp-settings__flash {
  outline: 2px solid var(--cp-highlight-border-strong);
  outline-offset: 2px;
  border-radius: 12px;
}

/* 选择器：`.cp-settings__nav`｜用途：设置 section 纵向导航 */
.cp-settings__nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 10px;
  min-height: 0;
  overflow: auto;
}

/* 窄窗口回退：导航回到顶部横向可换行排列 */
@media (max-width: 720px) {
  .cp-settings__layout {
    flex-direction: column;
  }

  .cp-settings__navWrap {
    width: auto;
    overflow: visible;
  }

  .cp-settings__nav {
    flex-direction: row;
    flex-wrap: wrap;
    overflow: visible;
  }

  .cp-settings__results {
    max-height: 240px;
  }
}

.cp-settings__navBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: var(--cp-text-muted);
  border-radius: 16px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
  text-align: left;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease), color var(--cp-fast) var(--cp-ease);
}

.cp-settings__navBtn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-settings__navBtn[data-active="true"] {
  color: var(--cp-text);
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

.cp-settings__navLabel {
  font-family: var(--cp-font-display);
  letter-spacing: 0.06em;
  font-size: 12px;
  text-transform: uppercase;
}

.cp-settings__navSub {
  font-size: 12px;
  line-height: 1.35;
}

/* 选择器：`.cp-settings__sections`｜用途：右侧 Tab 面板容器（一次只显示一个分区，超高时容器内滚动） */
.cp-settings__sections {
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}

/* 选择器：`.cp-settings__section`｜用途：单个设置分区面板（非当前 Tab 面板由 v-show 隐藏） */
.cp-settings__section {
  flex: 0 0 auto;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  scroll-margin-top: 12px;
}

.cp-settings__sectionHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.cp-settings__sectionName {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 16px;
  color: var(--cp-text);
}

.cp-settings__sectionSub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__grid`｜用途：section 卡片区域 */
.cp-settings__grid {
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

.cp-settings__card.wide {
  grid-column: 1 / -1;
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

/* 选择器：`.cp-settings__pluginItem`｜用途：单个插件设置项（标题 + 说明 + 插件控件） */
.cp-settings__pluginItem {
  border: 1px solid var(--cp-border-light);
  background: var(--cp-panel-muted);
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-settings__pluginHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.cp-settings__pluginTitle {
  font-size: 12px;
  color: var(--cp-text);
}

/* 选择器：`.cp-settings__placeholder`｜用途：暂未实现的 section 占位说明 */
.cp-settings__placeholder {
  margin-top: 10px;
  border: 1px dashed var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 16px;
  padding: 12px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.5;
}

/* 选择器：`.cp-settings__err`｜用途：内联错误提示 */
.cp-settings__err {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-danger, #b3261e);
  line-height: 1.45;
}

.cp-settings__rowWrap {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cp-settings__hiddenInput {
  display: none;
}

.cp-settings__statusInline {
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
}

.cp-settings__statusInline[data-tone="success"] {
  border-color: color-mix(in oklab, var(--cp-success) 24%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-success) 10%, var(--cp-panel));
}

.cp-settings__link {
  color: var(--cp-accent);
  text-decoration: none;
  font-size: 12px;
}

.cp-settings__link:hover {
  text-decoration: underline;
}

.cp-settings__statusInline[data-tone="danger"] {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
}
</style>
