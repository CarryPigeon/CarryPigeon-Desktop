<script setup lang="ts">
/**
 * @fileoverview UserInfoPage.vue 文件职责说明。
 */

import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { MessagePlugin } from "tdesign-vue-next";
import { emitUserProfileRequest, listenUserProfileResponse } from "@/shared/tauri";

const { t } = useI18n();
const route = useRoute();

const editable = computed(() => {
  const raw = String(route.query.editable ?? "");
  return raw === "1" || raw === "true";
});

const uid = computed(() => Number(route.query.uid ?? 0));

const initialProfile = {
  avatarUrl: String(route.query.avatar ?? ""),
  name: String(route.query.name ?? ""),
  email: String(route.query.email ?? ""),
  bio: String(route.query.bio ?? route.query.description ?? ""),
  sex: Number(route.query.sex ?? 0),
  birthday: Number(route.query.birthday ?? 0),
  avatarId: Number(route.query.avatar_id ?? -1),
};

const form = reactive({
  avatarUrl: initialProfile.avatarUrl,
  name: initialProfile.name,
  email: initialProfile.email,
  bio: initialProfile.bio,
  sex: initialProfile.sex,
  birthday: initialProfile.birthday,
  avatarId: initialProfile.avatarId,
});

const editing = ref(false);
const avatarPreview = ref(form.avatarUrl);
const avatarFile = ref<File | null>(null);
const emailCode = ref("");
const sendCodeLoading = ref(false);
const saveLoading = ref(false);

const birthdayInput = computed({
  get() {
    if (!form.birthday) return "";
    const date = new Date(form.birthday);
    return date.toISOString().slice(0, 10);
  },
  set(value: string) {
    if (!value) {
      form.birthday = 0;
      return;
    }
    const parsed = Date.parse(value);
    form.birthday = Number.isNaN(parsed) ? 0 : parsed;
  },
});

const originalEmail = initialProfile.email;

/**
 * createRequestId 方法说明。
 * @returns 返回值说明。
 */
function createRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const pendingRequests = new Map<string, "send_code" | "save" | "logout">();
let unlisten: null | (() => void) = null;

onMounted(async () => {
  unlisten = await listenUserProfileResponse((event) => {
    const { id, ok, message } = event.payload;
    const type = pendingRequests.get(id);
    if (!type) return;

    pendingRequests.delete(id);

    if (type === "send_code") {
      sendCodeLoading.value = false;
      if (ok) MessagePlugin.success(t("email_code_sent"));
      else MessagePlugin.error(message || t("email_code_failed"));
      return;
    }

    if (type === "save") {
      saveLoading.value = false;
      if (ok) {
        MessagePlugin.success(t("profile_saved"));
        editing.value = false;
      } else {
        MessagePlugin.error(message || t("profile_save_failed"));
      }
      return;
    }

    if (type === "logout") {
      saveLoading.value = false;
      if (ok) MessagePlugin.success(t("logout_success"));
      else MessagePlugin.error(message || t("logout_failed"));
    }
  });
});

onBeforeUnmount(() => {
  if (unlisten) unlisten();
});

/**
 * startEdit 方法说明。
 * @returns 返回值说明。
 */
function startEdit() {
  if (!editable.value) return;
  editing.value = true;
}

/**
 * cancelEdit 方法说明。
 * @returns 返回值说明。
 */
function cancelEdit() {
  editing.value = false;
  form.avatarUrl = initialProfile.avatarUrl;
  form.name = initialProfile.name;
  form.email = initialProfile.email;
  form.bio = initialProfile.bio;
  form.sex = initialProfile.sex;
  form.birthday = initialProfile.birthday;
  form.avatarId = initialProfile.avatarId;
  avatarPreview.value = initialProfile.avatarUrl;
  avatarFile.value = null;
  emailCode.value = "";
}

/**
 * handleAvatarChange 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  avatarFile.value = file;
  avatarPreview.value = URL.createObjectURL(file);
}

/**
 * sendEmailCode 方法说明。
 * @returns 返回值说明。
 */
async function sendEmailCode() {
  if (!form.email.trim()) {
    MessagePlugin.error(t("email_required"));
    return;
  }

  sendCodeLoading.value = true;
  const id = createRequestId();
  pendingRequests.set(id, "send_code");
  await emitUserProfileRequest({
    id,
    type: "send_email_code",
    email: form.email.trim(),
  });
}

/**
 * saveProfile 方法说明。
 * @returns 返回值说明。
 */
async function saveProfile() {
  if (!editable.value) return;
  if (!form.name.trim()) {
    MessagePlugin.error(t("username_required"));
    return;
  }

  const emailChanged = form.email.trim() !== originalEmail.trim();
  if (emailChanged && !emailCode.value.trim()) {
    MessagePlugin.error(t("email_code_required"));
    return;
  }

  saveLoading.value = true;
  const id = createRequestId();
  pendingRequests.set(id, "save");

  // TODO: 头像上传未接入，暂时沿用 avatarId
  await emitUserProfileRequest({
    id,
    type: "update_profile",
    profile: {
      username: form.name.trim(),
      avatar: form.avatarId ?? -1,
      sex: Number(form.sex) || 0,
      brief: form.bio.trim(),
      birthday: form.birthday || 0,
    },
    emailUpdate: emailChanged
      ? { email: form.email.trim(), code: emailCode.value.trim() }
      : undefined,
  });
}

/**
 * requestLogout 方法说明。
 * @returns 返回值说明。
 */
async function requestLogout() {
  if (!editable.value) return;
  saveLoading.value = true;
  const id = createRequestId();
  pendingRequests.set(id, "logout");
  await emitUserProfileRequest({ id, type: "logout" });
}
</script>

<template>
  <!-- 页面：UserInfoPage｜职责：用户信息查看/编辑（新窗口） -->
  <!-- 区块：<div> .user-profile -->
  <div class="user-profile">
    <!-- 区块：<div> .profile-card -->
    <div class="profile-card">
      <!-- 区块：<div> .header -->
      <div class="header">
        <!-- 区块：<div> .avatar-block -->
        <div class="avatar-block">
          <img class="avatar" :src="avatarPreview || form.avatarUrl" alt="avatar" />
          <label v-if="editing" class="avatar-upload">
            {{ $t('upload_avatar') }}
            <input type="file" accept="image/*" @change="handleAvatarChange" />
          </label>
        </div>
        <!-- 区块：<div> .title -->
        <div class="title">
          <!-- 区块：<div> .name -->
          <div class="name">{{ form.name || $t('user_info') }}</div>
          <!-- 区块：<div> .subtitle -->
          <div class="subtitle">UID: {{ uid }}</div>
        </div>
        <!-- 区块：<div> .actions -->
        <div class="actions">
          <!-- 区块：<button> -->
          <button v-if="!editing && editable" class="btn" @click="startEdit">{{ $t('edit') }}</button>
          <!-- 区块：<button> -->
          <button v-if="editing" class="btn primary" :disabled="saveLoading" @click="saveProfile">
            {{ saveLoading ? $t('loading') : $t('save') }}
          </button>
          <!-- 区块：<button> -->
          <button v-if="editing" class="btn ghost" @click="cancelEdit">{{ $t('cancel') }}</button>
        </div>
      </div>

      <!-- 区块：<div> .section -->
      <div class="section">
        <label class="field">
          <span>{{ $t('username') }}</span>
          <input class="cp-field" v-model="form.name" :disabled="!editing" type="text" />
        </label>

        <label class="field">
          <span>{{ $t('email') }}</span>
          <input class="cp-field" v-model="form.email" :disabled="!editing" type="email" />
        </label>

        <!-- 区块：<div> .field -->
        <div v-if="editing" class="field code-row">
          <span>{{ $t('email_code') }}</span>
          <!-- 区块：<div> .code-input -->
          <div class="code-input">
            <input class="cp-field" v-model="emailCode" type="text" :placeholder="$t('email_code_placeholder')" />
            <!-- 区块：<button> -->
            <button class="btn ghost" :disabled="sendCodeLoading" @click="sendEmailCode">
              {{ sendCodeLoading ? $t('loading') : $t('send_code') }}
            </button>
          </div>
        </div>

        <label class="field">
          <span>{{ $t('user_brief') }}</span>
          <textarea class="cp-field" v-model="form.bio" :disabled="!editing" rows="3"></textarea>
        </label>

        <label class="field">
          <span>{{ $t('sex') }}</span>
          <select class="cp-field" v-model.number="form.sex" :disabled="!editing">
            <option :value="0">{{ $t('sex_unknown') }}</option>
            <option :value="1">{{ $t('sex_male') }}</option>
            <option :value="2">{{ $t('sex_female') }}</option>
          </select>
        </label>

        <label class="field">
          <span>{{ $t('birthday') }}</span>
          <input class="cp-field" v-model="birthdayInput" :disabled="!editing" type="date" />
        </label>
      </div>

      <!-- 区块：<div> .logout-row -->
      <div v-if="editable" class="logout-row">
        <!-- 区块：<button> -->
        <button class="btn danger" type="button" @click="requestLogout">{{ $t('logout') }}</button>
      </div>

      <!-- 区块：<div> .todo-hint -->
      <div v-if="avatarFile && editing" class="todo-hint">
        {{ $t('avatar_upload_todo') }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：.user-profile */
.user-profile {
  width: 100%;
  height: 100%;
  padding: 18px;
  box-sizing: border-box;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profile-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  background: rgba(255, 253, 248, 0.78);
  border: 1px solid var(--cp-border);
  border-radius: 22px;
  box-shadow: var(--cp-shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: cp-fade-up 360ms var(--cp-ease, ease) both;
}

/* 样式：.header */
.header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
}

/* 样式：.avatar-block */
.avatar-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

/* 样式：.avatar */
.avatar {
  width: 88px;
  height: 88px;
  border-radius: 18px;
  object-fit: cover;
  background: rgba(20, 32, 29, 0.08);
  border: 1px solid var(--cp-border-light);
}

/* 样式：.avatar-upload */
.avatar-upload {
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
  cursor: pointer;
}

/* 样式：.avatar-upload input */
.avatar-upload input {
  display: none;
}

/* 样式：.title */
.title {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 样式：.name */
.name {
  font-size: 20px;
  font-weight: 700;
  color: var(--cp-text, #1a1a1a);
  letter-spacing: -0.02em;
}

/* 样式：.subtitle */
.subtitle {
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
}

/* 样式：.actions */
.actions {
  display: flex;
  gap: 8px;
}

/* 样式：.btn */
.btn {
  border: 1px solid var(--cp-border);
  background: rgba(255, 253, 248, 0.78);
  color: var(--cp-text, #1a1a1a);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast, 160ms) var(--cp-ease, ease),
    background-color var(--cp-fast, 160ms) var(--cp-ease, ease),
    opacity var(--cp-fast, 160ms) var(--cp-ease, ease);

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 253, 248, 0.92);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    transform: none;
  }
}

/* 样式：.btn.primary */
.btn.primary {
  background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-hover));
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 18px 40px rgba(15, 118, 110, 0.22);
}

/* 样式：.btn.danger */
.btn.danger {
  border-color: rgba(180, 35, 24, 0.24);
  background: rgba(180, 35, 24, 0.10);
  color: var(--cp-danger);
}

/* 样式：.btn.ghost */
.btn.ghost {
  background: transparent;
}

/* 样式：.section */
.section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 样式：.field */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
}

.field .cp-field {
  width: 100%;
}

.field textarea.cp-field {
  resize: none;
  min-height: 78px;
}

/* 样式：.code-row */
.code-row {
  gap: 8px;
}

/* 样式：.code-input */
.code-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.code-input .cp-field {
  flex: 1;
}

/* 样式：.todo-hint */
.todo-hint {
  font-size: 12px;
  color: var(--cp-text-light, #a3a3a3);
}

/* 样式：.logout-row */
.logout-row {
  display: flex;
  justify-content: flex-end;
}
</style>
