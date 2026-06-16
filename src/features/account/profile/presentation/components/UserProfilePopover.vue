/**
 * @fileoverview UserProfilePopover.vue
 * @description 用户信息悬浮卡组件 - 点击/悬停头像后弹出的用户信息卡片
 */

<template>
  <span class="cp-user-profile-popover-trigger" ref="triggerRef">
    <slot></slot>
  </span>

  <Teleport v-if="open" to="body">
    <div
      ref="popoverRef"
      class="cp-user-profile-popover"
      :class="{
        'cp-user-profile-popover--visible': isVisible,
        'cp-user-profile-popover--opening': isOpening
      }"
      :style="{ width: popoverWidth + 'px' }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <!-- 背景图片区域 -->
      <div class="cp-user-profile-popover__background">
        <div
          v-if="resolvedBackgroundUrl"
          class="cp-user-profile-popover__bg-image"
          :style="{ backgroundImage: `url(${resolvedBackgroundUrl})` }"
        ></div>
        <div v-else class="cp-user-profile-popover__bg-default"></div>

        <!-- 编辑背景按钮 (仅自己可见) -->
        <button
          v-if="isCurrentUser && canEdit"
          class="cp-user-profile-popover__edit-bg-btn"
          aria-label="更换背景图片"
          @click="handleEditBackground"
        >
          <t-icon name="camera" />
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          style="display: none"
          @change="handleFileChange"
        />
      </div>

      <!-- 内容区域 -->
      <div class="cp-user-profile-popover__content">
        <!-- 头像 -->
        <div
          class="cp-user-profile-popover__avatar-container"
          :class="{ 'cp-user-profile-popover__avatar-container--loading': loading }"
          @click="handleViewFullProfile"
        >
          <div v-if="loading" class="cp-user-profile-popover__avatar-skeleton"></div>
          <img
            v-else
            class="cp-user-profile-popover__avatar"
            :src="resolvedAvatarUrl"
            :alt="resolvedUsername"
          />
        </div>

        <!-- 信息 -->
        <div class="cp-user-profile-popover__info">
          <!-- 昵称 -->
          <div v-if="!loading" class="cp-user-profile-popover__username">
            {{ resolvedUsername }}
          </div>
          <div v-else class="cp-user-profile-popover__username-skeleton"></div>

          <!-- 邮箱 -->
          <div v-if="resolvedEmail" class="cp-user-profile-popover__email">
            <span>{{ resolvedEmail }}</span>
            <button
              class="cp-user-profile-popover__copy-btn"
              aria-label="复制邮箱"
              @click="handleCopyEmail"
            >
              <t-icon :name="copiedEmail ? 'check' : 'copy'" />
            </button>
          </div>
          <div v-else-if="loading" class="cp-user-profile-popover__email-skeleton"></div>

          <!-- UID -->
          <div v-if="props.userId" class="cp-user-profile-popover__uid">
            <span>{{ props.userId }}</span>
            <button
              class="cp-user-profile-popover__copy-btn"
              aria-label="复制用户 ID"
              @click="handleCopyUid"
            >
              <t-icon :name="copiedUid ? 'check' : 'copy'" />
            </button>
          </div>

          <!-- 简介 -->
          <div v-if="resolvedBio" class="cp-user-profile-popover__bio">
            {{ resolvedBio }}
          </div>
          <div v-else-if="loading" class="cp-user-profile-popover__bio-skeleton">
            <div class="cp-user-profile-popover__bio-line"></div>
            <div class="cp-user-profile-popover__bio-line short"></div>
          </div>

          <!-- 错误状态 -->
          <div v-if="error" class="cp-user-profile-popover__error">
            <span>{{ error }}</span>
            <button class="cp-user-profile-popover__retry-btn" @click="retryLoad">
              重试
            </button>
          </div>

          <!-- 底部按钮 -->
          <div v-if="!loading && !error" class="cp-user-profile-popover__actions">
            <button
              class="cp-user-profile-popover__action-btn"
              @click="handleViewFullProfile"
            >
              查看完整资料
            </button>
            <button
              v-if="isCurrentUser"
              class="cp-user-profile-popover__action-btn"
              @click="handleEditProfile"
            >
              编辑资料
            </button>
          </div>
        </div>
      </div>

      <!-- 箭头 -->
      <div class="cp-user-profile-popover__arrow" data-popper-arrow></div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { createPopper, type Placement, type Options } from "@popperjs/core";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { toast } from "@/shared/utils/toast";
import { createLogger } from "@/shared/utils/logger";
import { getUserUsecase, getUserMutationPort } from "@/features/account/profile/di/user.di";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import { currentUser } from "@/features/account/current-user/presentation/store/userData";
import { ensureValidAccessToken } from "@/shared/net/auth/api";

import type { UserPublic } from "@/features/account/profile/domain/types/UserTypes";
import type { UserProfilePopoverProps } from "./UserProfilePopover.props";

defineOptions({
  name: "UserProfilePopover",
});

const props = withDefaults(defineProps<UserProfilePopoverProps>(), {
  trigger: "both",
  popoverWidth: 320,
});

const router = useRouter();
const { t } = useI18n();
const logger = createLogger("userProfilePopover");
const serverConnectionCapabilities = getServerConnectionCapabilities();

// Refs
const triggerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// State
const open = ref(false);
const isOpening = ref(false);
const isVisible = ref(false);
const loading = ref(true);
const error = ref<string | null>(null);
const profile = ref<UserPublic | null>(null);
const copiedEmail = ref(false);
const copiedUid = ref(false);
const isCurrentUser = computed(() => {
  const currentUid = currentUser.id;
  return String(currentUid) === String(props.userId);
});
const canEdit = computed(() => {
  // 只有当前用户且支持 mutation 才能编辑
  return isCurrentUser.value;
});

// Computed
const resolvedUsername = computed(() => props.username ?? profile.value?.nickname ?? "");
const resolvedEmail = computed(() => props.email ?? profile.value?.email ?? "");
const resolvedBio = computed(() => props.bio ?? profile.value?.bio ?? "");
const resolvedAvatarUrl = computed(() => {
  const url = props.avatarUrl ?? profile.value?.avatar;
  return url || "https://picsum.photos/80/80?grayscale";
});
const resolvedBackgroundUrl = computed(() => {
  return props.backgroundUrl ?? profile.value?.backgroundUrl;
});

// Popper
let popperInstance: ReturnType<typeof createPopper> | null = null;
let hoverLeaveTimer: ReturnType<typeof setTimeout> | null = null;
let hoverEnterTimer: ReturnType<typeof setTimeout> | null = null;

// Load profile
async function loadProfile() {
  if (props.username !== undefined && props.email !== undefined && props.bio !== undefined) {
    // All info provided via props, no need to fetch
    profile.value = {
      uid: props.userId,
      nickname: props.username || "",
      avatar: props.avatarUrl,
      email: props.email,
      bio: props.bio,
      backgroundUrl: props.backgroundUrl,
    };
    loading.value = false;
    error.value = null;
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const serverSocket = serverConnectionCapabilities.workspace.readSocket();
    const accessToken = await ensureValidAccessToken(serverSocket);
    if (!serverSocket || !accessToken) {
      throw new Error("Not connected to server");
    }
    const usecase = getUserUsecase(serverSocket);
    const result = await usecase.execute(accessToken, props.userId);
    profile.value = result;
    error.value = null;
  } catch (e) {
    logger.error("Action: auth_profile_load_failed", {
      error: String(e),
    });
    error.value = "加载失败";
  } finally {
    loading.value = false;
  }
}

function retryLoad() {
  loadProfile();
}

// Popper management
function createPopperInstance() {
  if (!triggerRef.value || !popoverRef.value) return;

  const options: Partial<Options> = props.placement
    ? { placement: props.placement as Placement }
    : {
        placement: "bottom-start" as Placement,
        modifiers: [
          {
            name: "preventOverflow",
            options: {
              boundary: "viewport",
            },
          },
        ],
      };

  popperInstance = createPopper(triggerRef.value, popoverRef.value, options);
}

function updatePopper() {
  popperInstance?.update();
}

function destroyPopper() {
  if (popperInstance) {
    popperInstance.destroy();
    popperInstance = null;
  }
}

// Open/Close
function openPopover() {
  if (open.value) return;
  open.value = true;
  isOpening.value = false;
  isVisible.value = false;

  // 先注册事件监听器，然后再创建 popper
  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("keydown", handleEscapeKey, true);
  document.addEventListener("scroll", handleScroll, true);

  // 在下一帧创建 popper，避免与当前点击事件冲突
  requestAnimationFrame(() => {
    createPopperInstance();
    updatePopper();

    // 确保 popper 定位完成后再显示
    requestAnimationFrame(() => {
      isVisible.value = true;
      // 稍微延迟后再添加动画类，确保 visibility 先改变
      setTimeout(() => {
        isOpening.value = true;
      }, 10);
    });
  });
}

function closePopover() {
  if (!open.value) return;
  isVisible.value = false;
  isOpening.value = false;
  open.value = false;
  destroyPopper();
  document.removeEventListener("click", handleDocumentClick, true);
  document.removeEventListener("keydown", handleEscapeKey, true);
  document.removeEventListener("scroll", handleScroll, true);
}

function togglePopover() {
  if (open.value) {
    closePopover();
  } else {
    openPopover();
  }
}

// Event handlers
function handleDocumentClick(e: MouseEvent) {
  // 如果悬浮卡正在打开过程中，忽略这次点击
  if (isOpening.value) return;

  const target = e.target as Node;
  const clickedInsidePopover = popoverRef.value?.contains(target);
  const clickedInsideTrigger = triggerRef.value?.contains(target);

  if (!clickedInsidePopover && !clickedInsideTrigger) {
    closePopover();
  }
}

function handleEscapeKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closePopover();
  }
}

function handleScroll() {
  // Close on scroll as optional optimization
  closePopover();
}

// Click trigger
function handleTriggerClick(e: MouseEvent) {
  if (props.trigger !== "click" && props.trigger !== "both") return;
  // Stop propagation to avoid document click immediately closing it
  e.stopPropagation();
  togglePopover();
}

function handleTriggerMouseEnter() {
  if (props.trigger !== "hover" && props.trigger !== "both") return;

  if (hoverLeaveTimer) {
    clearTimeout(hoverLeaveTimer);
    hoverLeaveTimer = null;
  }

  hoverEnterTimer = setTimeout(() => {
    openPopover();
  }, 300);
}

function handleTriggerMouseLeave() {
  if (props.trigger !== "hover" && props.trigger !== "both") return;

  if (hoverEnterTimer) {
    clearTimeout(hoverEnterTimer);
    hoverEnterTimer = null;
  }

  // 鼠标离开触发器时，开始计时关闭
  if (open.value) {
    startCloseTimer();
  }
}

function handleMouseEnter() {
  // 鼠标进入悬浮卡时，清除关闭计时器
  if (hoverLeaveTimer) {
    clearTimeout(hoverLeaveTimer);
    hoverLeaveTimer = null;
  }
}

function handleMouseLeave() {
  // 鼠标离开悬浮卡时，开始计时关闭
  startCloseTimer();
}

function startCloseTimer() {
  if (hoverLeaveTimer) {
    clearTimeout(hoverLeaveTimer);
  }
  hoverLeaveTimer = setTimeout(() => {
    closePopover();
  }, 500);
}

// Copy email
async function handleCopyEmail() {
  const email = resolvedEmail.value;
  if (!email) return;

  try {
    await navigator.clipboard.writeText(email);
    copiedEmail.value = true;
    toast.success(t("copied_to_clipboard"));
    setTimeout(() => {
      copiedEmail.value = false;
    }, 2000);
  } catch (e) {
    toast.error(t("copy_failed"));
    logger.error("Action: auth_profile_copy_failed", {
      error: String(e),
    });
  }
}

async function handleCopyUid() {
  const uid = String(props.userId ?? "").trim();
  if (!uid) return;

  try {
    await navigator.clipboard.writeText(uid);
    copiedUid.value = true;
    toast.success(t("copied_to_clipboard"));
    setTimeout(() => {
      copiedUid.value = false;
    }, 2000);
  } catch (e) {
    toast.error(t("copy_failed"));
    logger.error("Action: auth_profile_copy_failed", {
      error: String(e),
      field: "uid",
    });
  }
}

// Navigation
function handleViewFullProfile() {
  closePopover();
  router.push({
    path: "/user_info",
    query: {
      uid: props.userId,
      name: resolvedUsername.value || undefined,
      email: resolvedEmail.value || undefined,
      bio: resolvedBio.value || undefined,
      avatarUrl: resolvedAvatarUrl.value || undefined,
      backgroundUrl: resolvedBackgroundUrl.value || undefined,
    },
  });
}

function handleEditProfile() {
  closePopover();
  router.push({
    path: "/user_info",
    query: {
      uid: props.userId,
      name: resolvedUsername.value || undefined,
      email: resolvedEmail.value || undefined,
      bio: resolvedBio.value || undefined,
      avatarUrl: resolvedAvatarUrl.value || undefined,
      backgroundUrl: resolvedBackgroundUrl.value || undefined,
    },
  });
}

// Edit background
function handleEditBackground() {
  fileInputRef.value?.click();
}

async function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Validate file type
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    toast.error(t("profile_image_type_error"));
    return;
  }

  // Validate file size (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    toast.error(t("profile_image_size_error"));
    return;
  }

  try {
    const serverSocket = serverConnectionCapabilities.workspace.readSocket();
    const accessToken = await ensureValidAccessToken(serverSocket);
    if (!serverSocket || !accessToken) {
      toast.error(t("profile_not_connected"));
      return;
    }

    const mutationPort = getUserMutationPort(serverSocket);
    const backgroundUrl = await mutationPort.updateUserBackgroundImage(accessToken, file);

    if (profile.value) {
      profile.value = {
        ...profile.value,
        backgroundUrl,
      };
    } else {
      profile.value = {
        uid: props.userId,
        nickname: resolvedUsername.value,
        avatar: props.avatarUrl,
        email: resolvedEmail.value,
        bio: resolvedBio.value,
        backgroundUrl,
      };
    }
    toast.success(t("profile_background_uploaded"));
  } catch (err) {
    logger.error("Action: auth_profile_background_upload_failed", {
      error: String(err),
    });
    toast.error(t("upload_failed"));
  }

  // Reset input
  if (fileInputRef.value) {
    fileInputRef.value.value = "";
  }
}

// Attach events to trigger
onMounted(() => {
  if (triggerRef.value) {
    triggerRef.value.addEventListener("click", handleTriggerClick);
    triggerRef.value.addEventListener("mouseenter", handleTriggerMouseEnter);
    triggerRef.value.addEventListener("mouseleave", handleTriggerMouseLeave);
  }

  // Preload if all info is already provided
  if (props.userId) {
    loadProfile();
  }
});

onUnmounted(() => {
  if (triggerRef.value) {
    triggerRef.value.removeEventListener("click", handleTriggerClick);
    triggerRef.value.removeEventListener("mouseenter", handleTriggerMouseEnter);
    triggerRef.value.removeEventListener("mouseleave", handleTriggerMouseLeave);
  }
  if (hoverEnterTimer) clearTimeout(hoverEnterTimer);
  if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
  destroyPopper();
  closePopover();
});

// Watch for userId change
watch(
  () => props.userId,
  () => {
    loadProfile();
  }
);
</script>

<style lang="scss" scoped>
.cp-user-profile-popover-trigger {
  display: inline-block;
  cursor: pointer;
}

.cp-user-profile-popover {
  position: absolute;
  z-index: 1000;
  background: var(--cp-panel);
  border-radius: 12px;
  box-shadow: var(--cp-shadow);
  overflow: hidden;
  transform-origin: top left;
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;
  visibility: hidden;
  transition: opacity 150ms ease-out, transform 150ms ease-out;

  &.cp-user-profile-popover--visible {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
    visibility: visible;
  }

  &.cp-user-profile-popover--opening {
    transition: opacity 200ms ease-out, transform 200ms ease-out;
  }

  &__background {
    position: relative;
    width: 100%;
    height: 120px;
    overflow: hidden;
    border-radius: 12px 12px 0 0;
  }

  &__bg-image {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
  }

  &__bg-default {
    width: 100%;
    height: 100%;
    background:
      radial-gradient(circle at 18% 22%, color-mix(in oklab, var(--cp-highlight) 42%, transparent), transparent 34%),
      linear-gradient(
        135deg,
        color-mix(in oklab, var(--cp-accent) 62%, var(--cp-panel)) 0%,
        color-mix(in oklab, var(--cp-primary) 54%, var(--cp-panel-muted)) 100%
      );
  }

  &__edit-bg-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in oklab, var(--cp-panel) 32%, transparent);
    color: var(--cp-text);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: color-mix(in oklab, var(--cp-panel) 48%, transparent);
    }

    :deep(svg) {
      width: 18px;
      height: 18px;
    }
  }

  &__content {
    position: relative;
    padding: 60px 20px 20px;
    background: var(--cp-panel);
  }

  &__avatar-container {
    position: absolute;
    top: -40px;
    left: 20px;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--cp-panel);
    padding: 4px;
    box-shadow: var(--cp-shadow-soft);
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.05);
    }
  }

  &__avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  &__avatar-skeleton {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--cp-skeleton);
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__username {
    font-family: var(--cp-font-display);
    font-size: 20px;
    font-weight: 900;
    color: var(--cp-text);
    line-height: 1.2;
  }

  &__username-skeleton {
    width: 60%;
    height: 24px;
    border-radius: 4px;
    background: var(--cp-skeleton);
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__email {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: var(--cp-text-muted);
    line-height: 1.4;
  }

  &__uid {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--cp-text-muted);
    line-height: 1.4;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  &__copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--cp-text-muted);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--cp-hover);
      color: var(--cp-text);
    }

    :deep(svg) {
      width: 14px;
      height: 14px;
    }
  }

  &__email-skeleton {
    width: 40%;
    height: 16px;
    border-radius: 4px;
    background: var(--cp-skeleton);
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__bio {
    margin-top: 8px;
    font-size: 14px;
    color: var(--cp-text);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__bio-skeleton {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .cp-user-profile-popover__bio-line {
      width: 100%;
      height: 12px;
      border-radius: 3px;
      background: var(--cp-skeleton);
      animation: pulse 1.5s ease-in-out infinite;

      &.short {
        width: 70%;
      }
    }
  }

  &__error {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--cp-danger);
    font-size: 14px;
  }

  &__retry-btn {
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--cp-border);
    background: transparent;
    color: var(--cp-text);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      background: var(--cp-hover);
    }
  }

  &__actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
  }

  &__action-btn {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--cp-primary);
    background: transparent;
    color: var(--cp-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--cp-primary);
      color: var(--cp-panel);
    }
  }

  &__arrow {
    background: var(--cp-panel);

    &::before {
      box-shadow: var(--cp-shadow-soft);
    }
  }
}

@keyframes popoverIn {
  0% {
    opacity: 0;
    transform: scale(0.95);
    visibility: hidden;
    pointer-events: none;
  }
  1% {
    visibility: visible;
    pointer-events: auto;
  }
  100% {
    opacity: 1;
    transform: scale(1);
    visibility: visible;
    pointer-events: auto;
  }
}

@keyframes popoverOut {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.95);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
