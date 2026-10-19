<script setup lang="ts">
/**
 * @fileoverview UserInfoPage.vue
 * @description account/profile｜页面：UserInfoPage。
 */

import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import BackButton from "@/shared/ui/BackButton.vue";
import { getAccountCapabilities } from "@/features/account/api";
import { getCurrentUserCapabilities } from "@/features/account/current-user/api";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import { getProfileCapabilities } from "@/features/account/profile/api";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { createLogger } from "@/shared/utils/logger";
import { toast } from "@/shared/utils/toast";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

type ProfileDraft = {
  username: string;
  email: string;
  emailCode: string;
  brief: string;
  avatarUrl: string;
  backgroundUrl: string;
};

const currentUserCapabilities = getCurrentUserCapabilities();
const currentUser = useObservedCapabilitySnapshot(currentUserCapabilities);
const accountCapabilities = getAccountCapabilities();
const serverConnectionCapabilities = getServerConnectionCapabilities();

const route = useRoute();
const router = useRouter();

const isEditing = ref(false);
const isSaving = ref(false);
const isSendingEmailCode = ref(false);
const backgroundFileInputRef = ref<HTMLInputElement | null>(null);
const isUploadingBackground = ref(false);
const { t } = useI18n();
const logger = createLogger("UserInfoPage");
const formError = ref("");
const formSuccess = ref("");
const draft = reactive<ProfileDraft>({
  username: "",
  email: "",
  emailCode: "",
  brief: "",
  avatarUrl: "",
  backgroundUrl: "",
});

/**
 * 读取某个字段的展示值（query 优先，store 作为兜底）。
 *
 * 说明：
 * - 该页面既可通过路由 query 直达，也可展示当前登录用户（store）。
 * - 统一用 `String(...)` 归一化，避免 query 为数组类型时导致渲染异常。
 *
 * @param key - query 字段名（例如 `uid` / `email`）。
 * @param fallback - store 兜底值。
 * @returns 归一化后的字符串值。
 */
function readQueryOrFallback(
  key: "uid" | "name" | "email" | "bio" | "avatarUrl" | "backgroundUrl",
  fallback: unknown,
): string {
  return String(route.query[key] ?? fallback ?? "");
}

/**
 * 读取要展示的用户 id（query 优先，store 兜底）。
 *
 * @returns 用户 id 字符串。
 */
const display = computed(() => ({
  uid: readQueryOrFallback("uid", currentUser.value.id),
  name: readQueryOrFallback("name", currentUser.value.username),
  email: readQueryOrFallback("email", currentUser.value.email),
  bio: readQueryOrFallback("bio", currentUser.value.description),
  avatarUrl: readQueryOrFallback("avatarUrl", currentUser.value.avatarUrl),
  backgroundUrl: readQueryOrFallback("backgroundUrl", currentUser.value.backgroundUrl),
}));

const uid = computed(() => display.value.uid);
const name = computed(() => display.value.name);
const email = computed(() => display.value.email);
const bio = computed(() => display.value.bio);
const avatarUrl = computed(() => display.value.avatarUrl);
const backgroundUrl = computed(() => display.value.backgroundUrl);
const isOwnProfile = computed(() => !uid.value || uid.value === currentUser.value.id);
const isEmailChanged = computed(() => draft.email.trim() !== email.value.trim());
const heroStyle = computed(() => {
  if (backgroundUrl.value) {
    // 背图遮罩使用语义表面色：浅色主题压向暖白、深色主题压向石墨，正文令牌始终可读。
    return {
      backgroundImage: [
        "linear-gradient(180deg, color-mix(in oklab, var(--cp-panel-solid) 18%, transparent) 0%, color-mix(in oklab, var(--cp-panel-solid) 56%, transparent) 56%, color-mix(in oklab, var(--cp-panel-solid) 82%, transparent) 100%)",
        `url(${backgroundUrl.value})`,
      ].join(", "),
    };
  }

  return {};
});

function syncDraftFromDisplay(): void {
  draft.username = display.value.name;
  draft.email = display.value.email;
  draft.emailCode = "";
  draft.brief = display.value.bio;
  draft.avatarUrl = display.value.avatarUrl;
  draft.backgroundUrl = display.value.backgroundUrl;
}

function readActiveServerSocket(): string {
  const socket = serverConnectionCapabilities.workspace.readSocket().trim();
  if (!socket) {
    throw new Error(t("profile_missing_socket"));
  }
  return socket;
}

function handleStartEdit(): void {
  syncDraftFromDisplay();
  formError.value = "";
  formSuccess.value = "";
  isEditing.value = true;
}

function handleCancelEdit(): void {
  syncDraftFromDisplay();
  formError.value = "";
  formSuccess.value = "";
  isEditing.value = false;
}

function validateDraft(): string {
  if (!draft.username.trim()) {
    return t("profile_name_required");
  }
  if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
    return t("email_invalid");
  }
  if (isEmailChanged.value && !draft.emailCode.trim()) {
    return t("email_code_required");
  }
  return "";
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message || fallback : String(error) || fallback;
}

async function handleSendEmailCode(): Promise<void> {
  if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
    formError.value = t("email_invalid");
    return;
  }

  isSendingEmailCode.value = true;
  formError.value = "";
  formSuccess.value = "";
  try {
    const outcome = await accountCapabilities.forServer(readActiveServerSocket()).sendVerificationCode(draft.email.trim());
    if (!outcome.ok) {
      formError.value = outcome.error.message;
      return;
    }
    formSuccess.value = t("email_code_sent");
  } catch (error) {
    formError.value = toErrorMessage(error, t("email_code_failed"));
  } finally {
    isSendingEmailCode.value = false;
  }
}

function handleUploadBackground() {
  backgroundFileInputRef.value?.click();
}

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return t("profile_image_type_error");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return t("profile_image_size_error");
  }
  return null;
}

async function handleBackgroundFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const error = validateImageFile(file);
  if (error) {
    toast.error(error);
    if (backgroundFileInputRef.value) backgroundFileInputRef.value.value = "";
    return;
  }
  isUploadingBackground.value = true;
  try {
    const serverSocket = serverConnectionCapabilities.workspace.readSocket();
    const accessToken = await ensureValidAccessToken(serverSocket);
    if (!serverSocket || !accessToken) {
      toast.error(t("profile_not_connected"));
      return;
    }
    const backgroundUrl = await getProfileCapabilities().updateUserBackgroundImage(
      serverSocket,
      accessToken,
      file,
    );
    draft.backgroundUrl = backgroundUrl;
    currentUserCapabilities.applyLocalProfilePatch({
      username: draft.username.trim(),
      email: draft.email.trim(),
      description: draft.brief.trim(),
      avatarUrl: draft.avatarUrl.trim(),
      backgroundUrl,
    });
    toast.success(t("profile_background_uploaded"));
  } catch (err) {
    logger.error("Action: auth_profile_background_upload_failed", { error: String(err) });
    toast.error(t("upload_failed"));
  } finally {
    isUploadingBackground.value = false;
    if (backgroundFileInputRef.value) backgroundFileInputRef.value.value = "";
  }
}

async function handleSaveEdit(): Promise<void> {
  const message = validateDraft();
  if (message) {
    formError.value = message;
    return;
  }

  isSaving.value = true;
  formError.value = "";
  formSuccess.value = "";
  try {
    const server = accountCapabilities.forServer(readActiveServerSocket());
    if (isEmailChanged.value) {
      const emailOutcome = await server.updateUserEmail(draft.email.trim(), draft.emailCode.trim());
      if (!emailOutcome.ok) {
        formError.value = emailOutcome.error.message;
        return;
      }
    }

	    const profileOutcome = await server.updateUserProfile({
	      username: draft.username.trim(),
	      avatar: draft.avatarUrl.trim(),
	      brief: draft.brief.trim(),
	    });
    if (!profileOutcome.ok) {
      formError.value = profileOutcome.error.message;
      return;
    }

    currentUserCapabilities.applyLocalProfilePatch({
      username: draft.username.trim(),
      email: draft.email.trim(),
      description: draft.brief.trim(),
      avatarUrl: draft.avatarUrl.trim(),
      backgroundUrl: draft.backgroundUrl.trim(),
    });
    formSuccess.value = t("profile_saved");
    isEditing.value = false;
  } catch (error) {
    formError.value = toErrorMessage(error, t("profile_save_failed"));
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <!-- 页面：UserInfoPage｜职责：用户资料展示 -->
  <!-- 区块：<main> .cp-info -->
  <main class="cp-info">
    <ErrorBoundary>
      <header class="cp-info__hero" :style="heroStyle">
        <div class="cp-info__hero-overlay"></div>
        <div class="cp-info__hero-top">
          <BackButton test-id="user-info-back" @click="router.back()" />
          <button v-if="isOwnProfile && !isEditing" class="cp-info__edit" type="button" @click="handleStartEdit">{{ t("profile_edit") }}</button>
          <button v-else-if="isOwnProfile" class="cp-info__edit" type="button" @click="handleCancelEdit">{{ t("cancel") }}</button>
        </div>
        <div v-if="isEditing" class="cp-info__hero-edit">
          <label class="cp-info__field">
            <span class="cp-info__fieldLabel">{{ t("profile_name") }}</span>
            <input v-model="draft.username" class="cp-info__input cp-field" type="text" autocomplete="name" />
          </label>
          <label class="cp-info__field">
            <span class="cp-info__fieldLabel">{{ t("email") }}</span>
            <input v-model="draft.email" class="cp-info__input cp-field" type="email" autocomplete="email" />
          </label>
          <label v-if="isEmailChanged" class="cp-info__field">
            <span class="cp-info__fieldLabel">{{ t("email_code") }}</span>
            <span class="cp-info__inline">
              <input v-model="draft.emailCode" class="cp-info__input cp-field" type="text" inputmode="numeric" />
              <button class="cp-info__smallBtn" :disabled="isSendingEmailCode" type="button" @click="handleSendEmailCode">
                {{ isSendingEmailCode ? t("profile_sending_code") : t("send_code") }}
              </button>
            </span>
          </label>
          <label class="cp-info__field">
            <!-- 服务端无独立头像上传端点；头像 URL 经 PATCH /users/me 的 avatar 字段保存 -->
            <span class="cp-info__fieldLabel">{{ t("upload_avatar") }}</span>
            <input v-model="draft.avatarUrl" class="cp-info__input cp-field" type="url" :placeholder="t('profile_avatar_url_hint')" />
          </label>
          <label class="cp-info__field">
            <span class="cp-info__fieldLabel">{{ t("profile_background") }}</span>
            <input ref="backgroundFileInputRef" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="handleBackgroundFileChange" />
            <span class="cp-info__inline">
              <input v-model="draft.backgroundUrl" class="cp-info__input cp-field" type="url" :placeholder="t('profile_bg_url_hint')" />
              <button class="cp-info__smallBtn" :disabled="isUploadingBackground" type="button" @click="handleUploadBackground">
                {{ isUploadingBackground ? t("uploading") : t("profile_background") }}
              </button>
            </span>
          </label>
          <label class="cp-info__field cp-info__field--wide">
            <span class="cp-info__fieldLabel">{{ t("user_brief") }}</span>
            <textarea v-model="draft.brief" class="cp-info__textarea cp-field" rows="4"></textarea>
          </label>
          <div v-if="formError" class="cp-info__status cp-info__status--error">{{ formError }}</div>
          <div v-if="formSuccess" class="cp-info__status cp-info__status--success">{{ formSuccess }}</div>
          <div class="cp-info__editActions">
            <button class="cp-info__cancel" type="button" @click="handleCancelEdit">{{ t("cancel") }}</button>
            <button class="cp-info__edit" :disabled="isSaving" type="button" @click="handleSaveEdit">
              {{ isSaving ? t("profile_saving") : t("save") }}
            </button>
          </div>
        </div>
        <div v-else class="cp-info__hero-content">
          <div class="cp-info__avatar">
            <img v-if="avatarUrl" class="cp-info__avatar-image" :src="avatarUrl" :alt="name || t('user_info')" />
            <div v-else class="cp-info__avatar-fallback">{{ (name || t("user_info")).slice(0, 1).toUpperCase() }}</div>
          </div>
          <div class="cp-info__hero-text">
            <div class="cp-info__name">{{ name || t("user_info") }}</div>
            <div class="cp-info__sub">{{ t("profile_subtitle") }}</div>
          </div>
        </div>
      </header>

      <section class="cp-info__body">
        <div class="cp-info__card">
          <div class="cp-info__k">uid</div>
          <div class="cp-info__v"><MonoTag :value="uid" :copyable="true" /></div>
        </div>
        <div class="cp-info__card">
          <div class="cp-info__k">email</div>
          <div class="cp-info__v"><MonoTag :value="email" :copyable="true" /></div>
        </div>
        <div class="cp-info__card wide">
          <div class="cp-info__k">bio</div>
          <div class="cp-info__v cp-info__bio">{{ bio || "—" }}</div>
        </div>
      </section>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* 样式：UserInfoPage｜规格：hero 横幅（语义 token 遮罩）+ body 玻璃面板 + cp-card */
/* 布局与变量说明：使用全局 `--cp-*` 变量；页面为“背图横幅 + 资料详情面板”。 */
.cp-info {
  height: 100%;
  padding: var(--cp-page-pad);
  display: flex;
  flex-direction: column;
  gap: var(--cp-page-gap);
}

/* hero 保留自定义渐变背景，外壳复用一级玻璃面板规格 */
.cp-info__hero {
  @include cp-glass-panel;

  position: relative;
  min-height: 220px;
  background:
    radial-gradient(circle at 20% 18%, color-mix(in oklab, var(--cp-accent) 26%, transparent), transparent 36%),
    linear-gradient(135deg, color-mix(in oklab, var(--cp-accent) 34%, var(--cp-panel)) 0%, color-mix(in oklab, var(--cp-accent-2) 20%, var(--cp-panel-muted)) 100%);
  background-size: cover;
  background-position: center;
  overflow: hidden;
  padding: 14px;
}

/* 遮罩改用语义表面色，文字令牌在明暗主题下都可读 */
.cp-info__hero-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in oklab, var(--cp-panel-solid) 18%, transparent) 0%, color-mix(in oklab, var(--cp-panel-solid) 34%, transparent) 36%, color-mix(in oklab, var(--cp-panel-solid) 82%, transparent) 100%),
    linear-gradient(90deg, color-mix(in oklab, var(--cp-panel-solid) 10%, transparent) 0%, transparent 42%);
  pointer-events: none;
}

.cp-info__hero-top {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.cp-info__hero-content {
  position: relative;
  z-index: 1;
  margin-top: 90px;
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.cp-info__avatar {
  flex: 0 0 auto;
  width: 84px;
  height: 84px;
  border-radius: 24px;
  padding: 4px;
  background: color-mix(in oklab, var(--cp-panel) 76%, transparent);
  box-shadow: var(--cp-shadow-soft);
  overflow: hidden;
}

.cp-info__avatar-image,
.cp-info__avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: 20px;
}

.cp-info__avatar-image {
  object-fit: cover;
}

.cp-info__avatar-fallback {
  display: grid;
  place-items: center;
  font-family: var(--cp-font-display);
  font-size: 32px;
  font-weight: 900;
  color: var(--cp-text);
  background: color-mix(in oklab, var(--cp-panel) 82%, var(--cp-accent));
}

.cp-info__hero-text {
  min-width: 0;
  flex: 1 1 auto;
}

/* 按钮：统一胶囊控件；编辑/保存为主操作（highlight），其余为默认胶囊 */
.cp-info__cancel {
  @include cp-pill-button;
}

.cp-info__edit {
  @include cp-pill-button(primary);
}

.cp-info__smallBtn {
  @include cp-pill-button;

  flex: 0 0 auto;
  min-height: var(--cp-field-height);
}

.cp-info__edit:disabled,
.cp-info__smallBtn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.cp-info__hero-edit {
  position: relative;
  z-index: 1;
  margin-top: 24px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.cp-info__field,
.cp-info__inline {
  display: flex;
  gap: 8px;
}

.cp-info__field {
  flex-direction: column;
}

.cp-info__field--wide,
.cp-info__status,
.cp-info__editActions {
  grid-column: 1 / -1;
}

/* 字段标签：普通标签排版（用户内容不做大写变换） */
.cp-info__fieldLabel {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

/* 输入/文本域：视觉由全局 .cp-field 提供，这里只约束布局 */
.cp-info__input,
.cp-info__textarea {
  min-width: 0;
  width: 100%;
}

.cp-info__textarea {
  resize: vertical;
}

.cp-info__inline .cp-info__input {
  flex: 1 1 auto;
}

/* 状态条：统一 cp-inline-status */
.cp-info__status {
  @include cp-inline-status(info);
}

.cp-info__status--error {
  @include cp-inline-status(danger);
}

.cp-info__status--success {
  @include cp-inline-status(success);
}

.cp-info__editActions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cp-info__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 24px;
  color: var(--cp-text);
  line-height: 1.1;
}

.cp-info__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* body：一级玻璃面板 */
.cp-info__body {
  @include cp-glass-panel;

  flex: 1 1 auto;
  min-height: 0;
  padding: var(--cp-page-pad);
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--cp-page-gap);
}

/* 资料卡：内嵌卡片 */
.cp-info__card {
  @include cp-card;

  padding: 12px;
}

.cp-info__card.wide {
  grid-column: 1 / -1;
}

/* 固定英文标签：统一微标签 */
.cp-info__k {
  @include cp-section-label;
}

.cp-info__v {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}

.cp-info__bio {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .cp-info {
    padding: 10px;
    gap: 10px;
  }

  .cp-info__hero {
    min-height: 200px;
  }

  .cp-info__hero-content {
    margin-top: 80px;
    align-items: flex-start;
  }

  .cp-info__hero-edit,
  .cp-info__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .cp-info__field--wide,
  .cp-info__status,
  .cp-info__editActions {
    grid-column: auto;
  }

  .cp-info__inline,
  .cp-info__editActions {
    flex-direction: column;
  }

  .cp-info__avatar {
    width: 72px;
    height: 72px;
    border-radius: 20px;
  }

  .cp-info__avatar-fallback {
    font-size: 28px;
  }

  .cp-info__name {
    font-size: 20px;
  }

  .cp-info__card.wide {
    grid-column: auto;
  }
}
</style>
