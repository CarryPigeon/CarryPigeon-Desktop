<script setup lang="ts">
/**
 * @fileoverview ContactsPage.vue
 * @description 联系人管理页面：搜索用户、查看资料、发起私聊。
 */

import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { readAuthToken } from "@/shared/utils/localState";
import { getAccountCapabilities } from "@/features/account/api";
import { httpChatApiPort } from "@/features/chat/data/chat-api/httpChatApiPort";
import { ensureValidAccessToken } from "@/shared/net/auth/authSessionManager";
import { createLogger } from "@/shared/utils/logger";
import type { UserPublic, CurrentUser } from "@/features/account/api-types";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";
import EmptyState from "@/shared/ui/EmptyState.vue";
import SkeletonBlock from "@/shared/ui/SkeletonBlock.vue";
import PageHeader from "@/shared/ui/PageHeader.vue";

const logger = createLogger("ContactsPage");
const router = useRouter();
const { t } = useI18n();

const searchQuery = ref("");
const searchResults = ref<UserPublic[]>([]);
const searching = ref(false);
const currentUser = ref<CurrentUser | null>(null);
const loading = ref(true);

const accountCapabilities = getAccountCapabilities();

// 加载当前用户资料
async function loadCurrentUser(): Promise<void> {
  const socket = getActiveChatServerSocket();
  if (!socket) {
    loading.value = false;
    return;
  }
  const token = readAuthToken(socket) || "";
  if (!token) {
    loading.value = false;
    return;
  }
  try {
    const account = accountCapabilities.forServer(socket);
    const user = await account.syncCurrentUserSnapshot(token);
    currentUser.value = user;
  } catch (e) {
    logger.warn("Action: chat_contacts_get_me_failed", { error: String(e) });
  } finally {
    loading.value = false;
  }
}

// 搜索用户
async function handleSearch(): Promise<void> {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return;

  const socket = getActiveChatServerSocket();
  if (!socket) return;
  const token = (await ensureValidAccessToken(socket)).trim();
  if (!token) return;

  searching.value = true;
  searchResults.value = [];
  try {
    const account = accountCapabilities.forServer(socket);
    // 先尝试按 uid 搜索，然后按名称匹配
    const users = await account.listUsers(token, [q]);
    searchResults.value = users.filter(
      (u) =>
        (u.nickname?.toLowerCase().includes(q)) ||
        (u.email?.toLowerCase().includes(q)) ||
        u.uid.toLowerCase().includes(q),
    );
  } catch (e) {
    logger.error("Action: chat_contacts_search_failed", { error: String(e) });
  } finally {
    searching.value = false;
  }
}

// 发起私聊
async function handleStartChat(user: UserPublic): Promise<void> {
  const socket = getActiveChatServerSocket();
  if (!socket) return;
  const token = (await ensureValidAccessToken(socket)).trim();
  if (!token) return;
  try {
    const channel = await httpChatApiPort.createChannel(socket, token, {
      name: user.nickname,
      brief: `Direct chat with ${user.nickname}`,
    });
    await router.push("/chat");
    logger.info("Action: chat_contacts_private_chat_created", { channelId: channel.id, targetUid: user.uid });
  } catch (e) {
    logger.error("Action: chat_contacts_create_chat_failed", { error: String(e) });
  }
}

// 查看用户资料
function handleViewProfile(uid: string): void {
  router.push({ path: "/user-info-popover", query: { uid } });
}

// 点击任意位置快速启动私聊（直接使用 CreateFriendPrivateChatDialog 兼容方案）
function handleQuickChat(): void {
  router.push("/chat");
}

loadCurrentUser();
</script>

<template>
  <main class="cp-contacts">
    <ErrorBoundary>
      <PageHeader
        :title="t('contacts_title')"
        back
        data-testid="contacts-header"
        @back="router.back()"
      />

      <!-- 当前用户资料卡 -->
      <section v-if="currentUser" class="cp-contacts__section">
        <div class="cp-contacts__card">
          <div class="cp-contacts__card-avatar">
            <div class="cp-contacts__avatar-placeholder">
              {{ currentUser.username?.[0] || currentUser.email?.[0] || "?" }}
            </div>
          </div>
          <div class="cp-contacts__card-info">
            <div class="cp-contacts__card-name">{{ currentUser.username || t("unknown") }}</div>
            <div class="cp-contacts__card-detail">{{ currentUser.email || currentUser.id }}</div>
          </div>
        </div>
      </section>

      <!-- 搜索区域 -->
      <section class="cp-contacts__section">
        <div class="cp-contacts__search-bar">
          <input
            v-model="searchQuery"
            class="cp-contacts__search-input"
            type="text"
            :placeholder="t('contacts_search_placeholder')"
            @keydown.enter="handleSearch"
          />
          <button
            class="cp-contacts__search-btn"
            type="button"
            :disabled="searching || !searchQuery.trim()"
            @click="handleSearch"
          >
            {{ t("search") }}
          </button>
        </div>
      </section>

      <!-- 搜索结果 -->
      <section class="cp-contacts__section cp-contacts__results">
        <div v-if="loading" class="cp-contacts__skeleton">
          <div v-for="i in 4" :key="i" class="cp-contacts__skeletonCard">
            <SkeletonBlock variant="avatar" />
            <div class="cp-contacts__skeletonInfo">
              <SkeletonBlock variant="title" width="120px" />
              <SkeletonBlock variant="text" width="80px" />
            </div>
          </div>
        </div>
        <div v-else-if="searching" class="cp-contacts__status">{{ t("searching") }}</div>
        <div v-else-if="searchResults.length === 0 && searchQuery && !searching" class="cp-contacts__status">
          {{ t("contacts_no_results") }}
        </div>
        <div v-else-if="searchResults.length > 0" class="cp-contacts__list">
          <div
            v-for="user in searchResults"
            :key="user.uid"
            class="cp-contacts__item"
          >
            <div class="cp-contacts__item-avatar">
              <div class="cp-contacts__avatar-placeholder cp-contacts__avatar-placeholder--sm">
                {{ user.nickname[0] || "?" }}
              </div>
            </div>
            <div class="cp-contacts__item-info">
              <div class="cp-contacts__item-name">{{ user.nickname }}</div>
              <div v-if="user.email" class="cp-contacts__item-email">{{ user.email }}</div>
            </div>
            <div class="cp-contacts__item-actions">
              <button
                class="cp-contacts__action-btn"
                type="button"
                :title="t('contacts_start_chat')"
                @click="handleStartChat(user)"
              >
                {{ t("contacts_chat") }}
              </button>
              <button
                class="cp-contacts__action-btn cp-contacts__action-btn--secondary"
                type="button"
                :title="t('contacts_view_profile')"
                @click="handleViewProfile(user.uid)"
              >
                {{ t("contacts_profile") }}
              </button>
            </div>
          </div>
        </div>
        <EmptyState
          v-else
          :description="t('contacts_empty_hint')"
        >
          <template #action>
            <button class="cp-contacts__action-btn" type="button" @click="handleQuickChat">
              {{ t("contacts_go_chat") }}
            </button>
          </template>
        </EmptyState>
      </section>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
.cp-contacts {
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.cp-contacts__section {
  flex-shrink: 0;
}

.cp-contacts__card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
}

.cp-contacts__avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--cp-accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  flex-shrink: 0;

  &--sm {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }
}

.cp-contacts__card-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--cp-text);
}

.cp-contacts__card-detail {
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-top: 2px;
}

.cp-contacts__search-bar {
  display: flex;
  gap: 8px;

  .cp-contacts__search-input {
    flex: 1;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid var(--cp-border);
    background: var(--cp-panel);
    color: var(--cp-text);
    font-size: 13px;
    outline: none;
    transition: border-color var(--cp-fast) var(--cp-ease);

    &:focus {
      border-color: var(--cp-accent);
    }

    &::placeholder {
      color: var(--cp-text-muted);
    }
  }
}

.cp-contacts__search-btn {
  padding: 10px 20px;
  border-radius: 999px;
  border: 1px solid var(--cp-accent);
  background: var(--cp-accent);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity var(--cp-fast) var(--cp-ease);

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.cp-contacts__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-contacts__skeletonCard {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: var(--cp-surface);
  border-radius: 12px;
}

.cp-contacts__skeletonInfo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.cp-contacts__status {
  text-align: center;
  padding: 24px;
  color: var(--cp-text-muted);
  font-size: 13px;
}

.cp-contacts__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--cp-border);
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  overflow: hidden;
}

.cp-contacts__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--cp-surface);
  transition: background-color var(--cp-fast) var(--cp-ease);

  &:hover {
    background: var(--cp-hover-bg);
  }
}

.cp-contacts__item-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--cp-text);
}

.cp-contacts__item-email {
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-top: 1px;
}

.cp-contacts__item-info {
  flex: 1;
  min-width: 0;
}

.cp-contacts__item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.cp-contacts__action-btn {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--cp-accent);
  background: var(--cp-accent);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
  transition: opacity var(--cp-fast) var(--cp-ease);

  &:hover {
    opacity: 0.9;
  }

  &--secondary {
    background: transparent;
    color: var(--cp-text);
    border-color: var(--cp-border);

    &:hover {
      background: var(--cp-hover-bg);
    }
  }
}
</style>
