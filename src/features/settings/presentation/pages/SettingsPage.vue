<script setup lang="ts">
/**
 * @fileoverview 设置页（SettingsPage.vue）。
 * @description 设置页（主题偏好、运行时预览与相关入口）。
 */

import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { IS_MOCK_ENABLED, MOCK_MODE } from "@/shared/config/runtime";
import { getAboutCapabilities } from "@/features/about/api";
import type { AppInfo } from "@/features/about/api-types";
import { checkForUpdate, type UpdateStatus } from "@/shared/updater/checkUpdate";
import { useSettingsPageModel } from "@/features/settings/presentation/composables/useSettingsPageModel";
import { DEFAULT_APP_THEME, type AppTheme } from "@/features/settings/domain/types/SettingsTypes";
import { DEFAULT_APP_LOCALE } from "@/shared/utils/locale";
import {
  exportSettingsEnvelope,
  importSettingsEnvelope,
  resetSettingsEnvelope,
} from "@/features/settings/application/settingsService";
import type { SettingsSchemaEnvelopeV1 } from "@/features/settings/api-types";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';
import { currentServerSocket } from "@/features/server-connection/api";
import { getAccountCapabilities } from "@/features/account/api";
import { readRefreshToken, clearAuthAndResumeState } from "@/shared/utils/localState";

const router = useRouter();
const { t } = useI18n();
const {
  theme,
  themeError,
  pickTheme,
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

const sectionIds = ["general", "business", "account", "data", "about"] as const;

type SectionId = (typeof sectionIds)[number];

const sectionNav = computed(() => [
  { id: "general" as const, label: t("general"), subtitle: t("settings_nav_general_sub") },
  { id: "business" as const, label: t("settings_business"), subtitle: t("settings_nav_business_sub") },
  { id: "account" as const, label: t("settings_account"), subtitle: t("settings_account_sub") },
  { id: "data" as const, label: t("settings_data"), subtitle: t("settings_nav_data_sub") },
  { id: "about" as const, label: t("menu_about"), subtitle: t("about_version") },
]);

const activeSectionId = ref<SectionId>("general");
const settingsSectionsRef = ref<HTMLElement | null>(null);
let sectionObserver: IntersectionObserver | null = null;

onMounted(() => {
  const container = settingsSectionsRef.value;
  if (!container) return;
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibility = new Map<string, number>();
      for (const entry of entries) {
        const id = entry.target.id.replace("settings-section-", "");
        visibility.set(id, entry.intersectionRatio);
      }
      let bestId: SectionId = activeSectionId.value;
      let bestRatio = 0;
      for (const [id, ratio] of visibility) {
        if (ratio > bestRatio && (sectionIds as readonly string[]).includes(id)) {
          bestRatio = ratio;
          bestId = id as SectionId;
        }
      }
      if (bestRatio > 0) activeSectionId.value = bestId;
    },
    { root: container, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
  );
  for (const id of sectionIds) {
    const el = document.getElementById(`settings-section-${id}`);
    if (el) sectionObserver.observe(el);
  }
});

onBeforeUnmount(() => {
  sectionObserver?.disconnect();
});

const appInfo = ref<AppInfo | null>(null);
const updateCheckState = ref<UpdateStatus | { kind: 'checking' }>({ kind: 'checking' });

async function handleCheckUpdate(): Promise<void> {
  updateCheckState.value = { kind: 'checking' };
  updateCheckState.value = await checkForUpdate();
}

onMounted(async () => {
  appInfo.value = await getAboutCapabilities().getAppInfo();
});
const importFileInput = ref<HTMLInputElement | null>(null);
const dataStatus = ref<{ tone: "success" | "danger"; message: string } | null>(null);

const shellStatus = computed(() =>
  themeError.value || preferencesError.value || businessPreferencesError.value
    ? {
        tone: "danger" as const,
        title: t("settings_status_error"),
        message: themeError.value || preferencesError.value || businessPreferencesError.value,
      }
    : {
        tone: "success" as const,
        title: t("settings_status_ready"),
        message: t("settings_status_ready_message"),
      },
);

function goToSection(sectionId: SectionId): void {
  activeSectionId.value = sectionId;
  document.getElementById(`settings-section-${sectionId}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function openPatchbay(): void {
  router.push("/chat");
}

function setDataStatus(tone: "success" | "danger", message: string): void {
  dataStatus.value = { tone, message };
}

function clearDataStatus(): void {
  dataStatus.value = null;
}

function normalizeImportTheme(raw: unknown): AppTheme | null {
  return raw === "patchbay" || raw === "legacy" || raw === "light" ? raw : null;
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

const logouting = ref(false);
const showLogoutConfirm = ref(false);

async function handleLogout(): Promise<void> {
  showLogoutConfirm.value = false;
  logouting.value = true;
  try {
    const socket = currentServerSocket.value.trim();
    if (socket) {
      const refreshToken = readRefreshToken(socket);
      if (refreshToken) {
        try {
          await getAccountCapabilities().forServer(socket).revokeToken(refreshToken);
        } catch {
          // best-effort: continue clearing local state even if revoke fails
        }
      }
      clearAuthAndResumeState(socket);
    }
    getAccountCapabilities().currentUser.clearSnapshot();
    void router.replace("/login");
  } catch (error) {
    logouting.value = false;
    setDataStatus("danger", String(error) || t("settings_logout_failed"));
  }
}
</script>

<template>
  <!-- 页面：SettingsPage｜职责：设置中心 shell（general / business / data） -->
  <!-- 区块：<main> .cp-settings -->
  <main class="cp-settings">
    <ErrorBoundary>
      <header class="cp-settings__head">
        <button class="cp-settings__back" data-testid="settings-back" type="button" @click="router.back()">{{ t("back") }}</button>
        <div class="cp-settings__title">
          <div class="cp-settings__name">{{ t("settings_title") }}</div>
          <div class="cp-settings__sub">{{ t("settings_subtitle") }}</div>
        </div>
        <button class="cp-settings__btn" data-testid="settings-open-patchbay" type="button" @click="openPatchbay">
          {{ t("settings_open_patchbay") }}
        </button>
      </header>

      <section class="cp-settings__toolbar">
        <div class="cp-settings__status" :data-tone="shellStatus.tone">
          <div class="cp-settings__statusK">{{ shellStatus.title }}</div>
          <div class="cp-settings__statusV">{{ shellStatus.message }}</div>
        </div>
        <div class="cp-settings__toolbarActions">
          <button class="cp-settings__btn" data-testid="settings-reset" type="button" @click="handleResetDefaults">
            {{ t("settings_reset_defaults") }}
          </button>
        </div>
      </section>

      <nav class="cp-settings__nav" :aria-label="t('settings_sections')">
        <button
          v-for="section in sectionNav"
          :key="section.id"
          class="cp-settings__navBtn"
          :data-active="activeSectionId === section.id"
          :data-testid="`settings-nav-${section.id}`"
          type="button"
          @click="goToSection(section.id)"
        >
          <span class="cp-settings__navLabel">{{ section.label }}</span>
          <span class="cp-settings__navSub">{{ section.subtitle }}</span>
        </button>
      </nav>

      <section ref="settingsSectionsRef" class="cp-settings__sections">
        <section id="settings-section-general" class="cp-settings__section" data-testid="settings-section-general">
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_general_preferences") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_general_preferences_sub") }}</div>
            </div>
          </header>

          <div v-if="preferencesError" class="cp-settings__err">{{ preferencesError }}</div>

          <div class="cp-settings__grid">
            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("settings_theme") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__seg">
                  <button
                    class="cp-settings__segBtn"
                    :data-active="theme === 'patchbay'"
                    data-testid="settings-theme-patchbay"
                    type="button"
                    @click="pickTheme('patchbay')"
                  >
                    {{ t("patchbay") }}
                  </button>
                  <button
                    class="cp-settings__segBtn"
                    :data-active="theme === 'legacy'"
                    data-testid="settings-theme-legacy"
                    type="button"
                    @click="pickTheme('legacy')"
                  >
                    {{ t("settings_theme_legacy") }}
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

            <div class="cp-settings__card">
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
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("auto_login") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-auto-login" :data-active="autoLogin" type="button" @click="toggleAutoLogin(!autoLogin)">
                    {{ autoLogin ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row">
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
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("close_to_tray") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-close-to-tray" :data-active="closeToTray" type="button" @click="toggleCloseToTray(!closeToTray)">
                    {{ closeToTray ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row">
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
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("settings_mock_api") }}</span>
                  <MonoTag :value="IS_MOCK_ENABLED ? 'true' : 'false'" title="VITE_USE_MOCK_API" :copyable="true" />
                </div>
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("settings_mock_mode") }}</span>
                  <MonoTag :value="MOCK_MODE" title="VITE_MOCK_MODE" :copyable="true" />
                </div>
                <div class="cp-settings__hint">{{ t("settings_runtime_hint") }}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="settings-section-business" class="cp-settings__section" data-testid="settings-section-business">
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
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("email_notifications") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-email-notifications" :data-active="emailNotifications" type="button" @click="toggleEmailNotifications(!emailNotifications)">
                    {{ emailNotifications ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("desktop_notifications") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-desktop-notifications" :data-active="desktopNotifications" type="button" @click="toggleDesktopNotifications(!desktopNotifications)">
                    {{ desktopNotifications ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("global_dnd") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-global-dnd" :data-active="globalDnd" type="button" @click="toggleGlobalDnd(!globalDnd)">
                    {{ globalDnd ? t("enabled") : t("disabled") }}
                  </button>
                </div>
                <div class="cp-settings__hint">{{ t("global_dnd_desc") }}</div>
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ t("notification_sound") }}</span>
                  <button class="cp-settings__segBtn" data-testid="settings-notification-sound" :data-active="notificationSound" type="button" @click="toggleNotificationSound(!notificationSound)">
                    {{ notificationSound ? t("enabled") : t("disabled") }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="settings-section-account" class="cp-settings__section" data-testid="settings-section-account">
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_account") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_account_sub") }}</div>
            </div>
          </header>

          <div class="cp-settings__grid">
            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("security") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__hint">{{ t("settings_logout_hint") }}</div>
                <button
                  class="cp-settings__btn cp-settings__btn--danger"
                  data-testid="settings-logout"
                  type="button"
                  :disabled="logouting"
                  @click="showLogoutConfirm = true"
                >
                  {{ logouting ? t("loading") : t("logout") }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 退出登录确认弹窗 -->
        <t-dialog
          v-model:visible="showLogoutConfirm"
          :header="t('logout')"
          :confirm-btn="{
            content: t('logout'),
            loading: logouting,
            theme: 'danger',
          }"
          :cancel-btn="t('cancel')"
          @confirm="handleLogout"
        >
          <p>{{ t("settings_logout_confirm") }}</p>
        </t-dialog>

        <section id="settings-section-data" class="cp-settings__section" data-testid="settings-section-data">
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("settings_data_management") }}</div>
              <div class="cp-settings__sectionSub">{{ t("settings_data_management_sub") }}</div>
            </div>
          </header>

          <div class="cp-settings__grid">
            <div class="cp-settings__card">
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

            <div class="cp-settings__card">
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

        <section v-if="appInfo" id="settings-section-about" class="cp-settings__section" data-testid="settings-section-about">
          <header class="cp-settings__sectionHead">
            <div>
              <div class="cp-settings__sectionName">{{ t("menu_about") }}</div>
              <div class="cp-settings__sectionSub">{{ t("about_version") }} {{ appInfo.version }}</div>
            </div>
          </header>
          <div class="cp-settings__grid">
            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("about_version") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ appInfo.name }}</span>
                  <MonoTag :value="appInfo.version" title="version" />
                </div>
              </div>
            </div>
            <div class="cp-settings__card">
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
            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("about_tech_stack") }}</div>
              <div class="cp-settings__v">
                <div v-for="item in appInfo.techStack" :key="item" class="cp-settings__row">
                  <span class="cp-settings__muted">{{ item }}</span>
                </div>
              </div>
            </div>
            <div class="cp-settings__card">
              <div class="cp-settings__k">{{ t("about_license") }}</div>
              <div class="cp-settings__v">
                <div class="cp-settings__row">
                  <span class="cp-settings__muted">{{ appInfo.license }}</span>
                </div>
              </div>
            </div>
            <div class="cp-settings__card">
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
    </ErrorBoundary>
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
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
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

/* 选择器：`.cp-settings__toolbar`｜用途：全局状态 / 主操作条 */
.cp-settings__toolbar {
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

/* 选择器：`.cp-settings__status`｜用途：成功/错误状态展示 */
.cp-settings__status {
  min-width: min(100%, 420px);
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 10px 12px;
}

.cp-settings__status[data-tone="success"] {
  border-color: color-mix(in oklab, var(--cp-success) 24%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-success) 10%, var(--cp-panel));
}

.cp-settings__status[data-tone="danger"] {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
}

.cp-settings__statusK {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-settings__statusV {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}

/* 选择器：`.cp-settings__toolbarActions`｜用途：全局操作按钮容器 */
.cp-settings__toolbarActions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

/* 选择器：`.cp-settings__nav`｜用途：设置 section tabs */
.cp-settings__nav {
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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

/* 选择器：`.cp-settings__sections`｜用途：可滚动 section 容器 */
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
  scroll-behavior: smooth;
  padding-right: 2px;
}

.cp-settings__section {
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
