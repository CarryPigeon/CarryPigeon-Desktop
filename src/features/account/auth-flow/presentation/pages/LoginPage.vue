<script setup lang="ts">
/**
 * @fileoverview LoginPage.vue
 * @description account/auth-flow｜页面：LoginPage（4 步登录向导）。
 */

import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getAuthFlowCapabilities } from "@/features/account/auth-flow/api";
import { useLoginWizard } from "../composables/useLoginWizard";
import { useLoginEmailAuth } from "../composables/useLoginEmailAuth";
import { useLoginHotkeys } from "../composables/useLoginHotkeys";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";

const router = useRouter();
const { t } = useI18n();
const authFlowCapabilities = getAuthFlowCapabilities();

let wizard: ReturnType<typeof useLoginWizard>;

const auth = useLoginEmailAuth({
  router,
  onRequiredSetup: (outcome) => {
    authFlowCapabilities.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
    void wizard.ensurePrepareData();
    wizard.goToPrepare();
  },
});

const { email, code, sending, loggingIn, banner, countdown, clearBanner, handleSendCode, handleLogin } = auth;

wizard = useLoginWizard({ onSocketDraftChanged: clearBanner });

const connecting = ref(false);
async function onConnect(): Promise<void> {
  connecting.value = true;
  try {
    await wizard.handleConnect();
  } finally {
    connecting.value = false;
  }
}

useLoginHotkeys(router);
</script>

<template>
  <!-- 页面：LoginPage｜职责：4 步登录向导（server → prepare → account） -->
  <!-- 区块：<main> .cp-login -->
  <main class="cp-login">
    <ErrorBoundary>
      <div class="cp-login__shell">
        <header class="cp-login__head">
          <div class="cp-login__brand">
            <div class="cp-login__brandMark" aria-hidden="true"></div>
            <div class="cp-login__brandText">
              <div class="cp-login__brandName">CarryPigeon</div>
              <div class="cp-login__brandSub">Modular Patchbay</div>
            </div>
          </div>
          <div class="cp-login__kbdHint">Ctrl/Cmd+P: Plugins · Ctrl/Cmd+,: Settings</div>
        </header>

        <nav class="cp-wizard" aria-label="login steps">
          <div class="cp-wizard__step" :data-active="wizard.step.value === 'server'">
            <span class="cp-wizard__num">1</span>
            <span class="cp-wizard__label">{{ t("login_step_server") }}</span>
          </div>
          <span class="cp-wizard__sep" aria-hidden="true">→</span>
          <div class="cp-wizard__step" :data-active="wizard.step.value === 'prepare'">
            <span class="cp-wizard__num">2</span>
            <span class="cp-wizard__label">{{ t("login_step_prepare") }}</span>
          </div>
          <span class="cp-wizard__sep" aria-hidden="true">→</span>
          <div class="cp-wizard__step" :data-active="wizard.step.value === 'account'">
            <span class="cp-wizard__num">3</span>
            <span class="cp-wizard__label">{{ t("login_step_account") }}</span>
          </div>
        </nav>

        <!-- Step 1: server -->
        <section v-if="wizard.step.value === 'server'" class="cp-login__panel">
          <h1 class="cp-login__panelTitle">{{ t("login_server_title") }}</h1>
          <p class="cp-login__panelSub">{{ t("login_server_desc") }}</p>

          <div class="cp-login__form">
            <div class="cp-login__field">
              <div class="cp-login__fieldLabel">server_socket</div>
              <t-input v-model="wizard.socketDraft.value" placeholder="tls://host:port or mock://handshake" clearable />
              <div class="cp-login__fieldHint">
                <MonoTag :value="wizard.currentServerSocket.value || '-'" title="current socket" :copyable="true" />
                <button class="cp-login__miniBtn" type="button" :disabled="connecting" @click="onConnect">
                  {{ connecting ? t("login_connecting") : t("login_connect") }}
                </button>
              </div>
            </div>

            <div class="cp-login__field">
              <div class="cp-login__fieldLabel">{{ t("login_transport_label") }}</div>
              <div class="cp-login__seg">
                <button class="cp-login__segBtn" :data-active="wizard.transport.value === 'tls_strict'" type="button" @click="wizard.transport.value = 'tls_strict'">
                  TLS Strict
                </button>
                <button class="cp-login__segBtn" :data-active="wizard.transport.value === 'tls_insecure'" type="button" @click="wizard.transport.value = 'tls_insecure'">
                  TLS Insecure
                </button>
                <button class="cp-login__segBtn" :data-active="wizard.transport.value === 'tcp_legacy'" type="button" @click="wizard.transport.value = 'tcp_legacy'">
                  TCP Legacy
                </button>
              </div>
            </div>

            <div class="cp-login__field">
              <div class="cp-login__fieldLabel">connection</div>
              <ConnectionPill
                :state="wizard.connectionPillState.value"
                label="Server link"
                :detail="wizard.connectionDetail.value"
                :action-label="wizard.serverConnectFailed.value ? 'Retry' : ''"
                @action="() => wizard.retryConnect()"
              />
            </div>

            <div class="cp-login__footRow">
              <button class="cp-login__ghost" type="button" @click="router.push('/servers')">
                {{ t("login_open_server_manager") }}
              </button>
              <button class="cp-login__ghost" type="button" @click="router.push('/plugins')">
                {{ t("login_open_plugin_center") }}
              </button>
            </div>
          </div>
        </section>

        <!-- Step 2: prepare -->
        <section v-else-if="wizard.step.value === 'prepare'" class="cp-login__panel">
          <h1 class="cp-login__panelTitle">{{ t("login_prepare_title") }}</h1>
          <p class="cp-login__panelSub">{{ t("login_prepare_desc") }}</p>

          <div class="cp-login__serverInfo">
            <div class="cp-login__serverInfoHead">
              <div class="cp-login__serverInfoName">{{ wizard.serverInfo.value?.name }}</div>
              <div class="cp-login__serverInfoId">
                <MonoTag :value="wizard.serverInfo.value?.serverId || '-'" :title="t('server_id_label')" :copyable="true" />
                <span v-if="wizard.serverInfo.value?.apiVersion" class="cp-login__serverInfoApi">{{ wizard.serverInfo.value?.apiVersion }}</span>
              </div>
            </div>
            <div class="cp-login__serverInfoBrief">{{ wizard.serverInfo.value?.brief }}</div>
            <div v-if="wizard.serverInfo.value?.requiredPlugins?.length" class="cp-login__serverInfoPlugins">
              <span class="cp-login__monoTitle">{{ t("login_server_id_hint") }}</span>
              <div class="cp-login__serverInfoTags">
                <MonoTag v-for="pid in (wizard.serverInfo.value?.requiredPlugins ?? [])" :key="pid" :value="pid" :copyable="true" />
              </div>
            </div>
            <div class="cp-login__confirmLine">{{ t("login_confirm_server") }}</div>
          </div>

          <h2 class="cp-login__sectionTitle">{{ t("login_required_plugins_title") }}</h2>

          <div v-if="wizard.requiredEntries.value.length === 0" class="cp-login__empty">
            {{ t("login_prepare_no_required") }}
          </div>

          <div v-else class="cp-required__list">
            <article
              v-for="p in wizard.requiredEntries.value"
              :key="p.pluginId"
              class="cp-required__item"
              :data-ok="Boolean(wizard.plugins.installedById.value[p.pluginId]?.enabled && wizard.plugins.installedById.value[p.pluginId]?.status === 'ok')"
            >
              <header class="cp-required__itemHead">
                <div class="cp-required__itemLeft">
                  <div class="cp-required__itemName">{{ p.name }}</div>
                  <div class="cp-required__itemMeta">
                    <MonoTag :value="p.pluginId" :title="t('server_id_label')" :copyable="true" />
                    <span class="cp-required__mini">{{ wizard.latestVersion(p) || "—" }}</span>
                  </div>
                </div>
                <div class="cp-required__itemBadges">
                  <LabelBadge variant="required" :label="t('badge_required')" />
                  <LabelBadge
                    v-if="wizard.plugins.installedById.value[p.pluginId]?.status === 'failed'"
                    variant="failed"
                    :label="t('badge_failed')"
                  />
                  <LabelBadge
                    v-else-if="wizard.plugins.installedById.value[p.pluginId]?.enabled"
                    variant="info"
                    :label="t('badge_enabled')"
                  />
                  <LabelBadge
                    v-else-if="wizard.plugins.installedById.value[p.pluginId]?.currentVersion"
                    variant="info"
                    :label="t('badge_installed')"
                  />
                  <LabelBadge v-else variant="info" :label="t('badge_missing')" />
                </div>
              </header>

              <div class="cp-required__itemDesc">{{ p.tagline }}</div>

              <footer class="cp-required__itemActions">
                <button
                  v-if="!wizard.plugins.installedById.value[p.pluginId]?.currentVersion"
                  class="cp-required__btn primary"
                  type="button"
                  :disabled="Boolean(wizard.currentServerSocket.value) && !Boolean(wizard.serverInfo.value?.serverId)"
                  @click="wizard.plugins.install(p, wizard.latestVersion(p))"
                >
                  {{ t("install") }}
                </button>
                <button
                  v-else-if="!wizard.plugins.installedById.value[p.pluginId]?.enabled"
                  class="cp-required__btn primary"
                  type="button"
                  :disabled="Boolean(wizard.currentServerSocket.value) && !Boolean(wizard.serverInfo.value?.serverId)"
                  @click="wizard.plugins.enable(p.pluginId)"
                >
                  {{ t("enable") }}
                </button>
                <button
                  v-else
                  class="cp-required__btn"
                  type="button"
                  :disabled="Boolean(wizard.currentServerSocket.value) && !Boolean(wizard.serverInfo.value?.serverId)"
                  @click="wizard.plugins.disable(p.pluginId)"
                >
                  {{ t("disable") }}
                </button>

                <button
                  class="cp-required__btn"
                  type="button"
                  @click="router.push({ path: '/plugins', query: { focus_plugin_id: p.pluginId, filter: 'required' } })"
                >
                  {{ t("plugin_center") }}
                </button>
              </footer>
            </article>
          </div>

          <div v-if="!wizard.allRequiredReady.value" class="cp-login__hint">
            {{ t("login_prepare_blocked") }}
          </div>

          <div class="cp-login__footRow">
            <button class="cp-login__ghost" type="button" @click="wizard.goToServer()">{{ t("login_back") }}</button>
            <button class="cp-login__primary" type="button" :disabled="!wizard.allRequiredReady.value" @click="wizard.beginAccount()">
              {{ t("login_next_account") }}
            </button>
          </div>
        </section>

        <!-- Step 3: account -->
        <section v-else class="cp-login__panel">
          <h1 class="cp-login__panelTitle">{{ t("login_account_title") }}</h1>
          <p class="cp-login__panelSub">{{ t("login_account_desc") }}</p>

          <div v-if="banner" class="cp-login__banner">{{ banner }}</div>

          <div class="cp-login__form">
            <div class="cp-login__formRow">
              <div class="cp-login__fieldLabel">email</div>
              <t-input v-model="email" placeholder="you@domain.com" clearable />
            </div>

            <div class="cp-login__formRow">
              <div class="cp-login__fieldLabel">code</div>
              <div class="cp-login__codeRow">
                <t-input v-model="code" placeholder="123456" clearable />
                <button class="cp-login__sendBtn" type="button" :disabled="sending || countdown > 0" @click="handleSendCode">
                  {{ countdown > 0 ? `Resend (${countdown})` : sending ? "Sending…" : "Send Code" }}
                </button>
              </div>
            </div>

            <button class="cp-login__primary" type="button" :disabled="loggingIn" @click="handleLogin">
              {{ loggingIn ? "Signing in…" : "Sign In / Register" }}
            </button>

            <div class="cp-login__formRow cp-login__registerRow">
              <span class="cp-login__muted">{{ t("login_no_account") }}</span>
              <button class="cp-login__ghost" type="button" @click="router.push('/register')">{{ t("login_register") }}</button>
            </div>

            <button class="cp-login__ghost" type="button" @click="wizard.goToPrepare()">{{ t("login_back") }}</button>
          </div>
        </section>
      </div>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* LoginPage styles (4-step wizard) */
/* Layout: centered wizard shell */
.cp-login {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 14px;
}

/* Shell card */
.cp-login__shell {
  width: min(640px, 100%);
  max-height: 100%;
  overflow: auto;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-elev-1, var(--cp-shadow-soft));
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Header (brand + hotkeys) */
.cp-login__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* Brand cluster */
.cp-login__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Brand mark */
.cp-login__brandMark {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--cp-highlight-border);
  background:
    radial-gradient(10px 10px at 30% 35%, color-mix(in oklab, var(--cp-highlight) 86%, transparent), transparent 60%),
    radial-gradient(12px 12px at 68% 60%, color-mix(in oklab, var(--cp-accent-2) 84%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-panel-solid) 72%, var(--cp-bg));
  box-shadow: var(--cp-elev-1, var(--cp-shadow-soft));
}

/* Brand name */
.cp-login__brandName {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 16px;
  color: var(--cp-text);
}

/* Brand subtitle */
.cp-login__brandSub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Hotkey hint */
.cp-login__kbdHint {
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Stepper */
.cp-wizard {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 999px;
  padding: 8px 12px;
  flex-wrap: wrap;
}

/* Stepper step */
.cp-wizard__step {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--cp-text-muted);
  transition: color var(--cp-fast) var(--cp-ease);
}

/* Stepper active step */
.cp-wizard__step[data-active="true"] {
  color: var(--cp-text);
}

/* Stepper number badge */
.cp-wizard__num {
  font-family: var(--cp-font-display);
  font-weight: 800;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  font-size: 12px;
}

/* Stepper active number badge */
.cp-wizard__step[data-active="true"] .cp-wizard__num {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* Stepper label */
.cp-wizard__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
}

/* Stepper separator */
.cp-wizard__sep {
  opacity: 0.55;
}

/* Panel (step body) */
.cp-login__panel {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 16px;
}

/* Panel title */
.cp-login__panelTitle {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Panel subtitle */
.cp-login__panelSub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.5;
}

/* Section title */
.cp-login__sectionTitle {
  margin-top: 16px;
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 15px;
  color: var(--cp-text);
}

/* Server info confirm card */
.cp-login__serverInfo {
  margin-top: 14px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 18px;
  padding: 14px;
}

/* Server info header */
.cp-login__serverInfoHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* Server info name */
.cp-login__serverInfoName {
  font-family: var(--cp-font-display);
  font-weight: 800;
  font-size: 16px;
  color: var(--cp-text);
}

/* Server info id row */
.cp-login__serverInfoId {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Server info api version */
.cp-login__serverInfoApi {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Server info brief */
.cp-login__serverInfoBrief {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.5;
}

/* Server info required plugins */
.cp-login__serverInfoPlugins {
  margin-top: 12px;
}

/* Server info tags */
.cp-login__serverInfoTags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Confirm line */
.cp-login__confirmLine {
  margin-top: 12px;
  font-size: 12px;
  color: var(--cp-text);
}

/* Empty state */
.cp-login__empty {
  margin-top: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.26);
  background: var(--cp-panel-muted);
  border-radius: 16px;
  padding: 14px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Blocked hint */
.cp-login__hint {
  margin-top: 12px;
  border: 1px dashed var(--cp-highlight-border);
  background: var(--cp-highlight-bg);
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--cp-text);
}

/* Footer row (back / next) */
.cp-login__footRow {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* Mono title */
.cp-login__monoTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Muted text */
.cp-login__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Field wrapper */
.cp-login__field {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

/* Field label */
.cp-login__fieldLabel {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 8px;
}

/* Field hint row */
.cp-login__fieldHint {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Mini connect button */
.cp-login__miniBtn {
  border: 1px solid var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-login__miniBtn:hover:enabled {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg-strong);
}

.cp-login__miniBtn:active:enabled {
  transform: translateY(0);
}

.cp-login__miniBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Transport segmented control */
.cp-login__seg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Transport segment button */
.cp-login__segBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-login__segBtn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

.cp-login__segBtn:active {
  transform: translateY(0);
}

.cp-login__segBtn[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* Form wrapper */
.cp-login__form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Form row */
.cp-login__formRow {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Register row */
.cp-login__registerRow {
  text-align: center;
  align-items: center;
}

/* Code row (input + send) */
.cp-login__codeRow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

/* Send code button */
.cp-login__sendBtn {
  height: var(--cp-field-height);
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 0 14px;
  min-width: 128px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-login__sendBtn:hover:enabled {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-login__sendBtn:active:enabled {
  transform: translateY(0);
}

.cp-login__sendBtn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Primary sign-in / next button */
.cp-login__primary {
  border: 1px solid var(--cp-highlight-border-strong);
  background:
    radial-gradient(140px 34px at 24% 0%, color-mix(in oklab, var(--cp-highlight) 24%, transparent), transparent 60%),
    radial-gradient(160px 38px at 78% 0%, color-mix(in oklab, var(--cp-accent) 18%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-panel-muted) 92%, transparent);
  color: var(--cp-text);
  border-radius: 999px;
  height: calc(var(--cp-field-height) + 6px);
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 18px 44px color-mix(in oklab, var(--cp-highlight) 16%, transparent);
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-login__primary:hover:enabled {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--cp-highlight) 66%, var(--cp-border));
  background:
    radial-gradient(140px 34px at 24% 0%, color-mix(in oklab, var(--cp-highlight) 30%, transparent), transparent 60%),
    radial-gradient(160px 38px at 78% 0%, color-mix(in oklab, var(--cp-accent) 22%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-hover-bg) 86%, var(--cp-panel-muted));
}

.cp-login__primary:active:enabled {
  transform: translateY(0);
}

.cp-login__primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Ghost navigation button */
.cp-login__ghost {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 10px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-login__ghost:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-login__ghost:active {
  transform: translateY(0);
}

/* Banner for inline feedback */
.cp-login__banner {
  margin-top: 12px;
  border: 1px dashed var(--cp-highlight-border);
  background: var(--cp-highlight-bg);
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--cp-text);
}

/* Required item card (reused from RequiredSetupPage) */
.cp-required__list {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.cp-required__item {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--cp-shadow-soft);
}

.cp-required__item[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 24%, var(--cp-border));
}

.cp-required__itemHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cp-required__itemName {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.02em;
  font-size: 16px;
  color: var(--cp-text);
}

.cp-required__itemMeta {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cp-required__mini {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-required__itemBadges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.cp-required__itemDesc {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.4;
}

.cp-required__itemActions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cp-required__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-required__btn:hover:enabled {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-required__btn:active:enabled {
  transform: translateY(0);
}

.cp-required__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-required__btn.primary:hover:enabled {
  border-color: color-mix(in oklab, var(--cp-accent) 42%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

.cp-required__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cp-login__miniBtn:focus-visible,
.cp-login__segBtn:focus-visible,
.cp-login__sendBtn:focus-visible,
.cp-login__primary:focus-visible,
.cp-login__ghost:focus-visible,
.cp-required__btn:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--cp-info) 42%, var(--cp-border));
  outline-offset: 2px;
}

@media (max-width: 560px) {
  .cp-login {
    padding: 12px;
  }

  .cp-login__shell {
    padding: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-login__miniBtn,
  .cp-login__segBtn,
  .cp-login__sendBtn,
  .cp-login__primary,
  .cp-login__ghost,
  .cp-required__btn {
    transition: none !important;
  }
}
</style>
