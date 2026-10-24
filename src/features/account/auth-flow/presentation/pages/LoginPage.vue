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
import { useLoginPasswordAuth } from "../composables/useLoginPasswordAuth";
import MonoTag from "@/shared/ui/MonoTag.vue";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";

const router = useRouter();
const { t } = useI18n();
const authFlowCapabilities = getAuthFlowCapabilities();

let wizard: ReturnType<typeof useLoginWizard>;

const authMethod = ref<"email" | "password">("email");

const emailAuth = useLoginEmailAuth({
  router,
  onRequiredSetup: (outcome) => {
    authFlowCapabilities.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
    void wizard.ensurePrepareData();
    wizard.goToPrepare();
  },
});

const passwordAuth = useLoginPasswordAuth({
  router,
  mode: "login",
  onRequiredSetup: (outcome) => {
    authFlowCapabilities.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
    void wizard.ensurePrepareData();
    wizard.goToPrepare();
  },
});

const {
  email,
  code,
  sending,
  loggingIn: emailLoggingIn,
  banner: emailBanner,
  countdown,
  clearBanner: clearEmailBanner,
  handleSendCode,
  handleLogin,
} = emailAuth;

const {
  username,
  password,
  loggingIn: passwordLoggingIn,
  banner: passwordBanner,
  clearBanner: clearPasswordBanner,
  handlePasswordAuth,
} = passwordAuth;

wizard = useLoginWizard({
  onSocketDraftChanged: () => {
    clearEmailBanner();
    clearPasswordBanner();
  },
});

const connecting = ref(false);
async function onConnect(): Promise<void> {
  connecting.value = true;
  try {
    await wizard.handleConnect();
  } finally {
    connecting.value = false;
  }
}

function switchAuthMethod(method: "email" | "password"): void {
  authMethod.value = method;
  clearEmailBanner();
  clearPasswordBanner();
}
</script>

<template>
  <!-- 页面：LoginPage｜职责：4 步登录向导（server → prepare → account） -->
  <!-- 区块：<main> .cp-login -->
  <main class="cp-login">
    <ErrorBoundary>
      <header class="cp-login__console">
        <div class="cp-login__brand">
          <div class="cp-login__brandMark" aria-hidden="true"></div>
          <div class="cp-login__brandText">
            <div class="cp-login__brandName">CarryPigeon</div>
            <div class="cp-login__brandSub">{{ t("app_tagline") }}</div>
          </div>
        </div>
      </header>

      <div class="cp-login__center">
        <div class="cp-login__shell">
          <!-- Step 1: server -->
          <section v-if="wizard.step.value === 'server'" class="cp-login__panel">
            <h1 class="cp-login__panelTitle">{{ t("login_server_title") }}</h1>

            <div class="cp-login__form">
              <div class="cp-login__field">
                <div class="cp-login__fieldLabel">{{ t("server_socket") }}</div>
                <t-input v-model="wizard.socketDraft.value" :placeholder="t('server_socket_placeholder')" clearable />
                <div class="cp-login__fieldHint">
                  <button class="cp-login__miniBtn" type="button" :disabled="connecting" @click="onConnect">
                    {{ connecting ? t("login_connecting") : t("login_connect") }}
                  </button>
                </div>
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

            <div class="cp-login__methodTabs" role="tablist">
              <button
                class="cp-login__methodTab"
                type="button"
                role="tab"
                :aria-selected="authMethod === 'email'"
                :data-active="authMethod === 'email'"
                @click="switchAuthMethod('email')"
              >
                {{ t("login_method_email") }}
              </button>
              <button
                class="cp-login__methodTab"
                type="button"
                role="tab"
                :aria-selected="authMethod === 'password'"
                :data-active="authMethod === 'password'"
                @click="switchAuthMethod('password')"
              >
                {{ t("login_method_password") }}
              </button>
            </div>

            <div v-if="authMethod === 'email' ? emailBanner : passwordBanner" class="cp-login__banner">
              {{ authMethod === "email" ? emailBanner : passwordBanner }}
            </div>

            <div v-if="authMethod === 'email'" class="cp-login__form">
              <div class="cp-login__formRow">
                <div class="cp-login__fieldLabel">{{ t("login_field_email") }}</div>
                <t-input v-model="email" :placeholder="t('login_email_placeholder')" clearable />
              </div>

              <div class="cp-login__formRow">
                <div class="cp-login__fieldLabel">{{ t("login_code") }}</div>
                <div class="cp-login__codeRow">
                  <t-input v-model="code" :placeholder="t('login_code_placeholder')" clearable />
                  <button class="cp-login__sendBtn" type="button" :disabled="sending || countdown > 0" @click="handleSendCode">
                    {{ countdown > 0 ? t("resend_in", { n: countdown }) : sending ? t("sending") : t("send_code") }}
                  </button>
                </div>
              </div>

              <button class="cp-login__primary" type="button" :disabled="emailLoggingIn" @click="handleLogin">
                {{ emailLoggingIn ? t("signing_in") : t("sign_in_register") }}
              </button>

              <div class="cp-login__formRow cp-login__registerRow">
                <span class="cp-login__muted">{{ t("login_no_account") }}</span>
                <button class="cp-login__ghost" type="button" @click="router.push('/register')">{{ t("login_register") }}</button>
              </div>

              <button class="cp-login__ghost" type="button" @click="wizard.goToPrepare()">{{ t("login_back") }}</button>
            </div>

            <div v-else class="cp-login__form">
              <div class="cp-login__formRow">
                <div class="cp-login__fieldLabel">{{ t("login_field_username") }}</div>
                <t-input v-model="username" :placeholder="t('login_username_placeholder')" clearable />
              </div>

              <div class="cp-login__formRow">
                <div class="cp-login__fieldLabel">{{ t("login_field_password") }}</div>
                <t-input v-model="password" type="password" :placeholder="t('login_password_placeholder')" clearable />
              </div>

              <button class="cp-login__primary" type="button" :disabled="passwordLoggingIn" @click="handlePasswordAuth">
                {{ passwordLoggingIn ? t("signing_in") : t("sign_in") }}
              </button>

              <div class="cp-login__formRow cp-login__registerRow">
                <span class="cp-login__muted">{{ t("login_no_account") }}</span>
                <button class="cp-login__ghost" type="button" @click="router.push('/register')">{{ t("login_register") }}</button>
              </div>

              <button class="cp-login__ghost" type="button" @click="wizard.goToPrepare()">{{ t("login_back") }}</button>
            </div>
          </section>
        </div>
      </div>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* 样式：LoginPage｜规格：无缝工作台——整页一张共享玻璃面（cp-workspace），向导内容为玻璃面上的透明居中列 */
.cp-login {
  @include cp-workspace;
}

/* 控制台头：品牌行，紧凑节奏、不画底部分割线 */
.cp-login__console {
  @include cp-console;
}

/* Brand cluster */
.cp-login__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* Brand mark */
.cp-login__brandMark {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid var(--cp-highlight-border);
  background:
    radial-gradient(9px 9px at 30% 35%, color-mix(in oklab, var(--cp-accent) 86%, transparent), transparent 60%),
    radial-gradient(11px 11px at 68% 60%, color-mix(in oklab, var(--cp-accent-2) 84%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-panel-solid) 72%, var(--cp-bg));
  box-shadow: var(--cp-elev-1, var(--cp-shadow-soft));
}

/* Brand name */
.cp-login__brandName {
  @include cp-console-title;
}

/* Brand subtitle */
.cp-login__brandSub {
  @include cp-console-sub;

  margin-top: 2px;
}

/* 居中容器：剩余空间内居中放向导列，溢出时可滚动 */
.cp-login__center {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* Wizard column：玻璃面上的透明居中列（margin auto 居中，溢出时仍可滚动） */
.cp-login__shell {
  width: min(640px, 100%);
  margin: auto;
  padding: 12px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: var(--cp-page-gap);
}

/* Panel title */
.cp-login__panelTitle {
  @include cp-section-title;
}

/* Section title */
.cp-login__sectionTitle {
  margin-top: 16px;
  @include cp-section-title;
}

/* Server info confirm card */
.cp-login__serverInfo {
  @include cp-card;

  margin-top: 14px;
  padding: 14px;
  background: var(--cp-panel-muted);
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
  border: 1px dashed var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: var(--cp-radius-card);
  padding: 14px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Blocked hint */
.cp-login__hint {
  @include cp-inline-status(warn);

  margin-top: 12px;
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

/* Mono title：本地化提示文案，仅保留弱化标签排版 */
.cp-login__monoTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

/* Muted text */
.cp-login__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Field wrapper */
.cp-login__field {
  display: flex;
  flex-direction: column;
}

/* Field label：普通字段标签（用户内容不做大写变换） */
.cp-login__fieldLabel {
  margin-bottom: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

/* Field hint row */
.cp-login__fieldHint {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Mini connect button：连接动作使用 accent 语义 */
.cp-login__miniBtn {
  @include cp-pill-button;

  border-color: color-mix(in oklab, var(--cp-accent) 40%, var(--cp-border));
  background: var(--cp-accent-soft);
  color: var(--cp-text);
}

.cp-login__miniBtn:hover:enabled {
  border-color: color-mix(in oklab, var(--cp-accent) 58%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 20%, transparent);
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

/* 登录方式分段控件：2 等分 */
.cp-login__methodTabs {
  @include cp-segmented;

  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 4px 0 10px;
}

.cp-login__methodTab {
  @include cp-segmented-item;

  text-align: center;
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
  @include cp-pill-button;

  height: var(--cp-field-height);
  min-width: 128px;
  white-space: nowrap;
}

/* Primary sign-in / next button：主操作使用 highlight 语义 */
.cp-login__primary {
  @include cp-pill-button(primary);

  min-height: var(--cp-field-height);
  font-size: 13px;
  font-weight: 600;
}

/* Ghost navigation button */
.cp-login__ghost {
  @include cp-pill-button;

  color: var(--cp-text-muted);
}

/* Banner for inline feedback：校验提示 / 验证码已发送 */
.cp-login__banner {
  @include cp-inline-status(info);

  margin-top: 12px;
}

/* Required item card (reused from RequiredSetupPage)：内嵌卡片 */
.cp-required__list {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--cp-page-gap);
}

.cp-required__item {
  @include cp-card;

  padding: 14px;
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
  @include cp-pill-button;
}

/* 安装/启用必需插件属于“开启”语义，使用 accent */
.cp-required__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 40%, var(--cp-border));
  background: var(--cp-accent-soft);
}

.cp-required__btn.primary:hover:enabled {
  border-color: color-mix(in oklab, var(--cp-accent) 58%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 20%, transparent);
}

.cp-login__miniBtn:focus-visible,
.cp-login__sendBtn:focus-visible,
.cp-login__primary:focus-visible,
.cp-login__ghost:focus-visible,
.cp-required__btn:focus-visible {
  outline: 2px solid var(--cp-highlight-border-strong);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .cp-login__shell {
    padding: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-login__miniBtn,
  .cp-login__sendBtn,
  .cp-login__primary,
  .cp-login__ghost,
  .cp-required__btn {
    transition: none !important;
  }
}
</style>
