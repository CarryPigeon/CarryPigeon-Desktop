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
import PanelGroup from "@/shared/ui/panel/PanelGroup.vue";
import PanelRow from "@/shared/ui/panel/PanelRow.vue";
import PanelSwitch from "@/shared/ui/panel/PanelSwitch.vue";
import SectionHead from "@/shared/ui/SectionHead.vue";
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
  groups: pluginPanelGroups,
  ensureLoaded: ensurePluginSettingsLoaded,
} = usePluginSettings();

// 应用信息（「关于」分区数据源）；在 navSections 之前声明：该 Tab 需按数据就绪出现。
const appInfo = ref<AppInfo | null>(null);

// 分区图标（均取自 shared/ui/icons/lucide-sprite；AppIcon 为应用内唯一图标入口）。
const SECTION_ICONS: Record<SettingsSectionId, string> = {
  general: "setting",
  business: "notification",
  ai: "ai-article",
  data: "package",
  plugins: "plug",
  about: "info-circle",
};

// 分区导航/内容区顺序与文案来自 settingsCatalog（单一真源）；
// 「插件设置」无插件设置项、「关于」未取得应用信息时不出现，保证每个导航项都有已渲染面板。
const navSections = computed(() =>
  SETTINGS_SECTIONS.filter((section) => {
    if (section.id === SETTINGS_PLUGINS_SECTION_ID) return pluginPanelGroups.value.length > 0;
    if (section.id === "about") return appInfo.value !== null;
    return true;
  }),
);

const sectionNav = computed(() =>
  navSections.value.map((section) => ({
    id: section.id,
    label: t(section.labelKey),
    subtitle: t(section.subtitleKey),
    icon: SECTION_ICONS[section.id],
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

/** 更新检查状态：idle 表示尚未检查（进入页面时按钮应可用，而不是一直处于 checking）。 */
type UpdateCheckState = UpdateStatus | { kind: "checking" } | { kind: "idle" };
const updateCheckState = ref<UpdateCheckState>({ kind: "idle" });
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
  updateCheckState.value = { kind: "checking" };
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
  <!-- 页面：SettingsPage｜职责：设置中心 shell（general / business / ai / data / plugins / about） -->
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
              <AppIcon class="cp-settings__searchIcon" name="search" :size="15" />
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
                <AppIcon name="close" :size="14" />
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
                :title="section.subtitle"
                type="button"
                @click="setActiveSection(section.id)"
              >
                <AppIcon class="cp-settings__navIcon" :name="section.icon" :size="16" />
                <span class="cp-settings__navLabel">{{ section.label }}</span>
              </button>
            </nav>
          </div>
        </aside>

        <section ref="settingsSectionsRef" class="cp-settings__sections">
          <!-- 分区：通用偏好 -->
          <section
            id="settings-section-general"
            v-show="activeSectionId === 'general'"
            class="cp-settings__section"
            role="tabpanel"
            aria-labelledby="settings-nav-general"
            data-testid="settings-section-general"
          >
            <div class="cp-settings__sectionBody">
              <SectionHead
                :icon="SECTION_ICONS.general"
                :title="t('settings_general_preferences')"
                :subtitle="t('settings_general_preferences_sub')"
              />

              <div v-if="preferencesError" class="cp-settings__err">{{ preferencesError }}</div>

              <PanelGroup :title="t('settings_group_appearance')">
                <PanelRow :label="t('settings_theme')" data-settings-item="general-theme">
                  <template v-if="themeError" #description>
                    <div class="cp-settings__err">{{ themeError }}</div>
                  </template>
                  <template #control>
                    <div class="cp-settings__seg" role="group" :aria-label="t('settings_theme')">
                      <button
                        class="cp-settings__segBtn"
                        :data-active="theme === 'system'"
                        :aria-pressed="theme === 'system'"
                        data-testid="settings-theme-system"
                        type="button"
                        @click="pickTheme('system')"
                      >
                        {{ t("settings_theme_system") }}
                      </button>
                      <button
                        class="cp-settings__segBtn"
                        :data-active="theme === 'dark'"
                        :aria-pressed="theme === 'dark'"
                        data-testid="settings-theme-dark"
                        type="button"
                        @click="pickTheme('dark')"
                      >
                        {{ t("settings_theme_dark") }}
                      </button>
                      <button
                        class="cp-settings__segBtn"
                        :data-active="theme === 'light'"
                        :aria-pressed="theme === 'light'"
                        data-testid="settings-theme-light"
                        type="button"
                        @click="pickTheme('light')"
                      >
                        {{ t("settings_theme_light") }}
                      </button>
                    </div>
                  </template>
                </PanelRow>

                <PanelRow :label="t('settings_accent')" data-settings-item="general-accent">
                  <template #description>
                    {{ t("settings_accent_hint") }}
                    <div v-if="accentError" class="cp-settings__err">{{ accentError }}</div>
                  </template>
                  <template #control>
                    <div class="cp-settings__seg" role="group" :aria-label="t('settings_accent')">
                      <button
                        class="cp-settings__segBtn"
                        :data-active="accent === 'default'"
                        :aria-pressed="accent === 'default'"
                        data-testid="settings-accent-default"
                        type="button"
                        @click="pickAccent('default')"
                      >
                        {{ t("settings_accent_default") }}
                      </button>
                      <button
                        class="cp-settings__segBtn"
                        :data-active="accent === 'patchbay'"
                        :aria-pressed="accent === 'patchbay'"
                        data-testid="settings-accent-patchbay"
                        type="button"
                        @click="pickAccent('patchbay')"
                      >
                        {{ t("settings_accent_patchbay") }}
                      </button>
                    </div>
                  </template>
                </PanelRow>

                <PanelRow
                  :label="t('settings_language')"
                  :description="t('settings_language_hint')"
                  data-settings-item="general-language"
                >
                  <template #control>
                    <div class="cp-settings__seg" role="group" :aria-label="t('settings_language')">
                      <button
                        class="cp-settings__segBtn"
                        :data-active="language === 'zh_cn'"
                        :aria-pressed="language === 'zh_cn'"
                        data-testid="settings-language-zh_cn"
                        type="button"
                        @click="selectLanguage('zh_cn')"
                      >
                        简体中文
                      </button>
                      <button
                        class="cp-settings__segBtn"
                        :data-active="language === 'en_us'"
                        :aria-pressed="language === 'en_us'"
                        data-testid="settings-language-en_us"
                        type="button"
                        @click="selectLanguage('en_us')"
                      >
                        English
                      </button>
                    </div>
                  </template>
                </PanelRow>
              </PanelGroup>

              <PanelGroup :title="t('settings_group_launch')">
                <PanelRow :label="t('auto_login')" data-settings-item="general-auto-login">
                  <template #control>
                    <PanelSwitch
                      :model-value="autoLogin"
                      :label="t('auto_login')"
                      data-testid="settings-auto-login"
                      @update:model-value="toggleAutoLogin"
                    />
                  </template>
                </PanelRow>
                <PanelRow :label="t('settings_auto_launch')" data-settings-item="general-auto-launch">
                  <template #control>
                    <PanelSwitch
                      :model-value="autoLaunch"
                      :label="t('settings_auto_launch')"
                      data-testid="settings-auto-launch"
                      @update:model-value="toggleAutoLaunch"
                    />
                  </template>
                </PanelRow>
                <PanelRow :label="t('close_to_tray')" data-settings-item="general-close-to-tray">
                  <template #control>
                    <PanelSwitch
                      :model-value="closeToTray"
                      :label="t('close_to_tray')"
                      data-testid="settings-close-to-tray"
                      @update:model-value="toggleCloseToTray"
                    />
                  </template>
                </PanelRow>
                <template #footer>{{ t("settings_startup_hint") }}</template>
              </PanelGroup>

              <PanelGroup :title="t('settings_group_updates')">
                <PanelRow :label="t('check_for_updates')" data-settings-item="general-check-for-updates">
                  <template #control>
                    <PanelSwitch
                      :model-value="checkForUpdates"
                      :label="t('check_for_updates')"
                      data-testid="settings-check-for-updates"
                      @update:model-value="toggleCheckForUpdates"
                    />
                  </template>
                </PanelRow>
              </PanelGroup>

              <PanelGroup :title="t('settings_runtime')">
                <PanelRow v-if="isDev" :label="t('settings_mock_api')">
                  <template #control>
                    <MonoTag :value="IS_MOCK_ENABLED ? 'true' : 'false'" title="VITE_USE_MOCK_API" :copyable="true" />
                  </template>
                </PanelRow>
                <PanelRow v-if="isDev" :label="t('settings_mock_mode')">
                  <template #control>
                    <MonoTag :value="MOCK_MODE" title="VITE_MOCK_MODE" :copyable="true" />
                  </template>
                </PanelRow>
                <PanelRow
                  :label="t('settings_diagnostics_mode')"
                  :description="t('settings_diagnostics_mode_desc')"
                  data-settings-item="general-diagnostics-mode"
                >
                  <template #control>
                    <PanelSwitch
                      :model-value="diagnosticsMode"
                      :label="t('settings_diagnostics_mode')"
                      data-testid="settings-diagnostics-mode"
                      @update:model-value="toggleDiagnosticsMode"
                    />
                  </template>
                </PanelRow>
                <PanelRow :label="t('diagnostics_panel_title')" data-settings-item="general-diagnostics-panel">
                  <template #control>
                    <button
                      class="cp-settings__btn"
                      data-testid="settings-open-diagnostics-panel"
                      type="button"
                      :disabled="!diagnosticsMode && !isDev"
                      @click="diagnosticsVisible = true"
                    >
                      {{ t("diagnostics_open_panel") }}
                    </button>
                  </template>
                </PanelRow>
                <template #footer>{{ t("settings_runtime_hint") }}</template>
              </PanelGroup>
            </div>
          </section>

          <!-- 分区：业务设置 -->
          <section
            id="settings-section-business"
            v-show="activeSectionId === 'business'"
            class="cp-settings__section"
            role="tabpanel"
            aria-labelledby="settings-nav-business"
            data-testid="settings-section-business"
          >
            <div class="cp-settings__sectionBody">
              <SectionHead
                :icon="SECTION_ICONS.business"
                :title="t('settings_business_settings')"
                :subtitle="t('settings_business_settings_sub')"
              />

              <div v-if="businessPreferencesError" class="cp-settings__err">{{ businessPreferencesError }}</div>

              <PanelGroup :title="t('notifications')">
                <PanelRow :label="t('email_notifications')" data-settings-item="business-email-notifications">
                  <template #control>
                    <PanelSwitch
                      :model-value="emailNotifications"
                      :label="t('email_notifications')"
                      data-testid="settings-email-notifications"
                      @update:model-value="toggleEmailNotifications"
                    />
                  </template>
                </PanelRow>
                <PanelRow :label="t('desktop_notifications')" data-settings-item="business-desktop-notifications">
                  <template #control>
                    <PanelSwitch
                      :model-value="desktopNotifications"
                      :label="t('desktop_notifications')"
                      data-testid="settings-desktop-notifications"
                      @update:model-value="toggleDesktopNotifications"
                    />
                  </template>
                </PanelRow>
                <PanelRow
                  :label="t('global_dnd')"
                  :description="t('global_dnd_desc')"
                  data-settings-item="business-global-dnd"
                >
                  <template #control>
                    <PanelSwitch
                      :model-value="globalDnd"
                      :label="t('global_dnd')"
                      data-testid="settings-global-dnd"
                      @update:model-value="toggleGlobalDnd"
                    />
                  </template>
                </PanelRow>
                <PanelRow :label="t('notification_sound')" data-settings-item="business-notification-sound">
                  <template #control>
                    <PanelSwitch
                      :model-value="notificationSound"
                      :label="t('notification_sound')"
                      data-testid="settings-notification-sound"
                      @update:model-value="toggleNotificationSound"
                    />
                  </template>
                </PanelRow>
              </PanelGroup>
            </div>
          </section>

          <!-- 分区：AI 服务 -->
          <section
            id="settings-section-ai"
            v-show="activeSectionId === 'ai'"
            class="cp-settings__section"
            role="tabpanel"
            aria-labelledby="settings-nav-ai"
            data-testid="settings-section-ai"
          >
            <div class="cp-settings__sectionBody">
              <SectionHead
                :icon="SECTION_ICONS.ai"
                :title="t('settings_ai_service')"
                :subtitle="t('settings_ai_service_sub')"
              />

              <PanelGroup padded data-settings-item="ai-provider">
                <ErrorBoundary>
                  <AiProviderSettings />
                </ErrorBoundary>
              </PanelGroup>
            </div>
          </section>

          <!-- 分区：数据管理 -->
          <section
            id="settings-section-data"
            v-show="activeSectionId === 'data'"
            class="cp-settings__section"
            role="tabpanel"
            aria-labelledby="settings-nav-data"
            data-testid="settings-section-data"
          >
            <div class="cp-settings__sectionBody">
              <SectionHead
                :icon="SECTION_ICONS.data"
                :title="t('settings_data_management')"
                :subtitle="t('settings_data_management_sub')"
              />

              <PanelGroup>
                <PanelRow :label="t('settings_import_export_reset')" data-settings-item="data-import-export">
                  <template #description>
                    {{ t("settings_import_export_hint") }}
                    <div
                      v-if="dataStatus"
                      class="cp-settings__statusInline"
                      :data-tone="dataStatus.tone"
                    >
                      {{ dataStatus.message }}
                    </div>
                  </template>
                  <template #control>
                    <button
                      class="cp-settings__btn cp-settings__btn--primary"
                      data-testid="settings-export"
                      type="button"
                      @click="handleExportSettings"
                    >
                      {{ t("settings_export") }}
                    </button>
                    <button
                      class="cp-settings__btn"
                      data-testid="settings-import"
                      type="button"
                      @click="triggerImportDialog"
                    >
                      {{ t("settings_import") }}
                    </button>
                    <button
                      class="cp-settings__btn cp-settings__btn--danger"
                      data-testid="settings-reset-defaults"
                      type="button"
                      @click="handleResetDefaults"
                    >
                      {{ t("settings_reset_defaults") }}
                    </button>
                    <input
                      ref="importFileInput"
                      class="cp-settings__hiddenInput"
                      type="file"
                      accept="application/json,.json"
                      @change="handleImportFileChange"
                    />
                  </template>
                </PanelRow>
              </PanelGroup>

              <PanelGroup :title="t('settings_entrypoints')" data-settings-item="data-entrypoints">
                <button
                  class="cp-settings__linkRow"
                  data-testid="settings-open-server-manager"
                  type="button"
                  @click="router.push('/servers')"
                >
                  <span>{{ t("settings_open_server_manager") }}</span>
                  <AppIcon class="cp-settings__linkRowIcon" name="chevron-right" :size="16" />
                </button>
                <button
                  class="cp-settings__linkRow"
                  data-testid="settings-open-plugin-center"
                  type="button"
                  @click="router.push('/plugins')"
                >
                  <span>{{ t("settings_open_plugin_center") }}</span>
                  <AppIcon class="cp-settings__linkRowIcon" name="chevron-right" :size="16" />
                </button>
                <button
                  class="cp-settings__linkRow"
                  data-testid="settings-open-required-setup"
                  type="button"
                  @click="router.push('/required-setup')"
                >
                  <span>{{ t("settings_open_required_setup") }}</span>
                  <AppIcon class="cp-settings__linkRowIcon" name="chevron-right" :size="16" />
                </button>
                <button
                  class="cp-settings__linkRow"
                  data-testid="settings-open-file-manager"
                  type="button"
                  @click="router.push('/files')"
                >
                  <span>{{ t("file_manager") }}</span>
                  <AppIcon class="cp-settings__linkRowIcon" name="chevron-right" :size="16" />
                </button>
                <button
                  class="cp-settings__linkRow"
                  data-testid="settings-open-emoji-manage"
                  type="button"
                  @click="router.push('/settings/emoji')"
                >
                  <span>{{ t("manage_emojis") }}</span>
                  <AppIcon class="cp-settings__linkRowIcon" name="chevron-right" :size="16" />
                </button>
              </PanelGroup>
            </div>
          </section>

          <!-- 分区：插件设置｜用途：插件通过 ctx.ui.registerSettingsItem 注册的设置项（无项时不渲染） -->
          <section
            v-if="pluginPanelGroups.length > 0"
            id="settings-section-plugins"
            v-show="activeSectionId === 'plugins'"
            class="cp-settings__section"
            role="tabpanel"
            aria-labelledby="settings-nav-plugins"
            data-testid="settings-section-plugins"
          >
            <div class="cp-settings__sectionBody">
              <SectionHead
                :icon="SECTION_ICONS.plugins"
                :title="t('settings_plugins_section')"
                :subtitle="t('settings_plugins_section_sub')"
              />

              <PanelGroup
                v-for="group in pluginPanelGroups"
                :key="group.pluginId"
                :title="t('settings_plugin_source', { id: group.pluginId })"
                :uppercase="false"
              >
                <PanelRow
                  v-for="item in group.items"
                  :key="item.id"
                  :label="item.title"
                  :description="item.description"
                  layout="stack"
                  :data-settings-item="settingsPluginItemAnchor(item.pluginId, item.id)"
                  :data-testid="`settings-plugin-item-${item.pluginId}-${item.id}`"
                >
                  <template #control>
                    <!-- 单个插件控件抛错只降级该项，不影响其余设置 -->
                    <ErrorBoundary>
                      <component :is="item.component" />
                    </ErrorBoundary>
                  </template>
                </PanelRow>
              </PanelGroup>
            </div>
          </section>

          <!-- 分区：关于 -->
          <section
            v-if="appInfo"
            id="settings-section-about"
            v-show="activeSectionId === 'about'"
            class="cp-settings__section"
            role="tabpanel"
            aria-labelledby="settings-nav-about"
            data-testid="settings-section-about"
          >
            <div class="cp-settings__sectionBody">
              <SectionHead
                :icon="SECTION_ICONS.about"
                :title="t('menu_about')"
                :subtitle="`${t('about_version')} ${appInfo.version}`"
              />

              <PanelGroup>
                <PanelRow :label="t('about_version')" data-settings-item="about-version">
                  <template #description>{{ appInfo.name }}</template>
                  <template #control>
                    <MonoTag :value="appInfo.version" title="version" />
                  </template>
                </PanelRow>

                <PanelRow :label="t('check_for_updates')" data-settings-item="about-check-updates">
                  <template #description>
                    <template v-if="updateCheckState.kind === 'up_to_date'">
                      {{ t("settings_up_to_date") }}
                    </template>
                    <template v-else-if="updateCheckState.kind === 'update_available'">
                      {{ t("settings_update_available") }} v{{ updateCheckState.version }}
                      <a
                        :href="updateCheckState.releaseUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="cp-settings__link"
                      >{{ t("updater_download_page") }}</a>
                    </template>
                    <span v-else-if="updateCheckState.kind === 'error'" class="cp-settings__err">
                      {{ updateCheckState.message }}
                    </span>
                  </template>
                  <template #control>
                    <button
                      class="cp-settings__btn"
                      data-testid="settings-check-update-now"
                      type="button"
                      :disabled="updateCheckState.kind === 'checking'"
                      @click="handleCheckUpdate"
                    >
                      {{ updateCheckState.kind === "checking" ? t("update_step_checking") : t("check_for_updates") }}
                    </button>
                  </template>
                </PanelRow>

                <PanelRow :label="t('about_tech_stack')" layout="stack" data-settings-item="about-tech-stack">
                  <template #control>
                    <div class="cp-settings__chips">
                      <span v-for="item in appInfo.techStack" :key="item" class="cp-settings__chip">{{ item }}</span>
                    </div>
                  </template>
                </PanelRow>

                <PanelRow :label="t('about_license')" data-settings-item="about-license">
                  <template #control>
                    <span class="cp-settings__value">{{ appInfo.license }}</span>
                  </template>
                </PanelRow>

                <PanelRow :label="t('about_credits')" layout="stack" data-settings-item="about-credits">
                  <template #control>
                    <div class="cp-settings__credits">
                      <template v-for="credit in appInfo.credits" :key="credit.name">
                        <a
                          v-if="credit.url"
                          :href="credit.url"
                          target="_blank"
                          rel="noopener"
                          class="cp-settings__link"
                        >{{ credit.name }}</a>
                        <span v-else class="cp-settings__value">{{ credit.name }}</span>
                      </template>
                    </div>
                  </template>
                </PanelRow>
              </PanelGroup>
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
  @include cp-page;
}

/* 选择器：`.cp-settings__layout`｜用途：左右布局容器（左侧导航 + 右侧内容） */
.cp-settings__layout {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

/* 选择器：`.cp-settings__navWrap`｜用途：左侧固定宽导航侧栏 */
.cp-settings__navWrap {
  flex: 0 0 auto;
  width: 240px;
  overflow: auto;
  display: flex;
}

/* 选择器：`.cp-settings__rail`｜用途：左栏面板容器（搜索固定在上，导航/结果列表滚动） */
.cp-settings__rail {
  @include cp-glass-panel;

  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 10px;
  padding: 10px;
  min-height: 0;
}

/* 选择器：`.cp-settings__search`｜用途：设置搜索输入框容器 */
.cp-settings__search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 12px;
  padding: 0 10px;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease);
}

.cp-settings__search:focus-within {
  border-color: var(--cp-focus-border);
  background: var(--cp-field-bg);
  box-shadow: var(--cp-focus-ring, var(--cp-ring));
}

.cp-settings__searchIcon {
  color: var(--cp-text-muted);
  flex: 0 0 auto;
}

/* 选择器：`.cp-settings__searchInput`｜用途：原生搜索输入（无边框，融入面板底色） */
.cp-settings__searchInput {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  font-size: 13px;
  line-height: 1.4;
  outline: none;
}

.cp-settings__searchInput::placeholder {
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__searchClear`｜用途：清空搜索按钮 */
.cp-settings__searchClear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--cp-text-muted);
  cursor: pointer;
  padding: 0;
  transition: color var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-settings__searchClear:hover {
  color: var(--cp-text);
  background: var(--cp-hover-bg);
}

/* 选择器：`.cp-settings__results`｜用途：搜索结果列表（查询非空时替换导航） */
.cp-settings__results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-settings__resultsHead {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
  padding: 6px 8px 4px;
}

.cp-settings__resultsEmpty {
  font-size: 12px;
  color: var(--cp-text-muted);
  padding: 8px;
  line-height: 1.5;
}

/* 选择器：`.cp-settings__result`｜用途：搜索结果行（键盘/鼠标高亮） */
.cp-settings__result {
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text);
  border-radius: 10px;
  padding: 9px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  transition: background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-settings__result:hover {
  background: var(--cp-hover-bg);
}

.cp-settings__result[data-active="true"] {
  background: var(--cp-highlight-bg);
  border-color: var(--cp-highlight-border);
}

.cp-settings__resultTitle {
  font-size: 13px;
  line-height: 1.4;
  color: var(--cp-text);
}

.cp-settings__resultMeta {
  font-size: 11px;
  line-height: 1.4;
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
  gap: 2px;
  min-height: 0;
  overflow: auto;
  padding: 2px;
}

.cp-settings__navBtn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--cp-text-muted);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-settings__navBtn:hover {
  background: var(--cp-hover-bg);
  color: var(--cp-text);
}

/* 选中态：低饱和高亮底 + 左侧细条，避免整圈描边带来的“聚焦框”感 */
.cp-settings__navBtn[data-active="true"] {
  border-color: var(--cp-highlight-border);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
  box-shadow: inset 2px 0 0 var(--cp-highlight);
}

.cp-settings__navIcon {
  flex: 0 0 auto;
  color: var(--cp-text-muted);
}

.cp-settings__navBtn[data-active="true"] .cp-settings__navIcon {
  color: var(--cp-highlight);
}

.cp-settings__navLabel {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 选择器：`.cp-settings__sections`｜用途：右侧 Tab 面板容器（一次只显示一个分区，超高时容器内滚动） */
.cp-settings__sections {
  @include cp-glass-panel;

  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* 选择器：`.cp-settings__section`｜用途：单个设置分区（非当前 Tab 由 v-show 隐藏） */
.cp-settings__section {
  flex: 0 0 auto;
  padding: 28px 32px 40px;
  scroll-margin-top: 12px;
}

/* 选择器：`.cp-settings__sectionBody`｜用途：内容列（限制行宽，避免宽屏下标签与控件相距过远） */
.cp-settings__sectionBody {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.cp-settings__sectionBody > .cp-settings__err {
  margin-bottom: 14px;
}

/* 选择器：`.cp-settings__seg`｜用途：连接式分段控件容器 */
.cp-settings__seg {
  @include cp-segmented;
}

/* 选择器：`.cp-settings__segBtn`｜用途：分段控件选项 */
.cp-settings__segBtn {
  @include cp-segmented-item;
}

/* 选择器：`.cp-settings__btn`｜用途：动作按钮（导入/导出/打开弹窗等） */
.cp-settings__btn {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  font-size: 12.5px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-settings__btn:hover:not(:disabled) {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-settings__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cp-settings__btn--primary {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

.cp-settings__btn--danger {
  border-color: color-mix(in oklab, var(--cp-danger) 40%, var(--cp-border));
  color: var(--cp-danger);
}

.cp-settings__btn--danger:hover:not(:disabled) {
  border-color: var(--cp-danger);
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-hover-bg));
}

/* 选择器：`.cp-settings__linkRow`｜用途：入口类整行按钮（标签 + chevron） */
.cp-settings__linkRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  border: 0;
  border-top: 1px solid var(--cp-border-light);
  background: transparent;
  color: var(--cp-text);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-settings__linkRow:first-child {
  border-top: 0;
}

.cp-settings__linkRow:hover {
  background: var(--cp-hover-bg);
}

.cp-settings__linkRowIcon {
  flex: 0 0 auto;
  color: var(--cp-text-muted);
}

/* 选择器：`.cp-settings__hint`｜用途：帮助提示段落 */
.cp-settings__hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
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

/* 选择器：`.cp-settings__err`｜用途：内联错误提示 */
.cp-settings__err {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-danger);
}

.cp-settings__statusInline {
  margin-top: 8px;
  border: 1px solid var(--cp-border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
}

.cp-settings__statusInline[data-tone="success"] {
  border-color: color-mix(in oklab, var(--cp-success) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-success) 10%, var(--cp-panel));
}

.cp-settings__statusInline[data-tone="danger"] {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
}

.cp-settings__link {
  color: var(--cp-accent);
  text-decoration: none;
  font-size: 12px;
}

.cp-settings__link:hover {
  text-decoration: underline;
}

.cp-settings__value {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--cp-text);
}

.cp-settings__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cp-settings__chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border: 1px solid var(--cp-border-light);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  font-family: var(--cp-font-mono);
  font-size: 11px;
  line-height: 1.5;
}

.cp-settings__credits {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.cp-settings__hiddenInput {
  display: none;
}

/* 响应式：宽屏收窄分区内边距 */
@media (max-width: 1180px) {
  .cp-settings__section {
    padding: 24px 24px 32px;
  }
}

/* 响应式：窄窗口改为纵向布局，导航回到顶部横向换行 */
@media (max-width: 900px) {
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

  .cp-settings__navBtn {
    width: auto;
    min-height: 34px;
    padding: 6px 10px;
  }

  .cp-settings__navBtn[data-active="true"] {
    box-shadow: none;
  }

  .cp-settings__results {
    max-height: 240px;
  }

  .cp-settings__section {
    padding: 20px 16px 28px;
  }
}

/* 响应式：极窄窗口压缩页面留白并让分段控件占满整行 */
@media (max-width: 640px) {
  .cp-settings {
    padding: 10px;
  }

  .cp-settings__section {
    padding: 16px 12px 24px;
  }

  .cp-settings__seg {
    width: 100%;
  }

  .cp-settings__segBtn {
    flex: 1 1 auto;
  }
}
</style>
