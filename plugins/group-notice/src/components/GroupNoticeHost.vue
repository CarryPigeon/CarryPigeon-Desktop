<template>
  <div v-if="visible" class="group-notice-host">
    <div class="group-notice-panel">
      <div class="group-notice-panel__header">
        <t-icon name="notification" />
        <span class="group-notice-panel__title">{{ t("group_notice_panel_title") }}</span>
        <div class="group-notice-panel__actions">
          <t-button size="small" variant="outline" :loading="loading" @click="refresh(currentChannelId)">
            {{ t("group_notice_refresh") }}
          </t-button>
          <t-button
            v-if="unreadNotices.length > 0"
            size="small"
            variant="text"
            @click="markAllRead"
          >
            {{ t("group_notice_mark_all_read") }}
          </t-button>
          <t-button size="small" variant="text" @click="close">
            {{ t("group_notice_close") }}
          </t-button>
        </div>
      </div>
      <div class="group-notice-panel__body">
        <div v-if="errorText" class="group-notice-panel__error">{{ errorText }}</div>
        <div v-else-if="loading && notices.length === 0" class="group-notice-panel__hint">
          {{ t("group_notice_loading") }}
        </div>
        <div v-else-if="notices.length === 0" class="group-notice-panel__hint">
          {{ t("group_notice_empty") }}
        </div>
        <template v-else>
          <div
            v-for="item in notices"
            :key="item.noticeId"
            class="group-notice-panel__item"
            :class="[
              `group-notice-panel__item--${item.level}`,
              { 'group-notice-panel__item--unread': isUnread(item) },
            ]"
          >
            <div class="group-notice-panel__item-header">
              <span class="group-notice-panel__item-title">{{ item.title }}</span>
              <span
                class="group-notice-panel__item-badge"
                :class="isUnread(item) ? 'group-notice-panel__item-badge--unread' : ''"
              >
                {{ isUnread(item) ? t("group_notice_unread") : t("group_notice_read") }}
              </span>
            </div>
            <div class="group-notice-panel__item-body">{{ item.body }}</div>
            <div v-if="formatTime(item.issuedAt)" class="group-notice-panel__item-time">
              {{ formatTime(item.issuedAt) }}
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { getContext } from "../host/bridge";
import { createLogger } from "../shared/logger";
import { diffNewNotices, parseGroupNoticesResponse, type GroupNotice } from "../domain/groupNotice";
import { t } from "../i18n";

const logger = createLogger("GroupNoticeHost");

/** 已读游标存储 key（按频道隔离） */
function readIdsStorageKey(channelId: string): string {
  return `group_notice.read_ids:${channelId}`;
}

const visible = ref(false);
const loading = ref(false);
const currentChannelId = ref("");
const notices = ref<GroupNotice[]>([]);
const readIds = ref<Set<string>>(new Set());
const errorText = ref("");

const unreadNotices = computed(() => diffNewNotices(notices.value, readIds.value));

function isUnread(item: GroupNotice): boolean {
  return !readIds.value.has(item.noticeId);
}

function formatTime(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

/** 从插件存储读取已读游标（容错：任意异常视为无已读记录）。 */
async function loadReadIds(channelId: string): Promise<Set<string>> {
  try {
    const raw = await getContext().host.storage.get(readIdsStorageKey(channelId));
    if (Array.isArray(raw)) {
      return new Set(raw.map((x) => String(x)).filter(Boolean));
    }
  } catch (e) {
    logger.warn("group_notice_read_ids_load_failed", { error: String(e) });
  }
  return new Set();
}

/** 拉取并刷新通知列表（工具栏点击 / 面板刷新按钮共用）。 */
async function refresh(channelId: string): Promise<void> {
  const ch = String(channelId ?? "").trim();
  visible.value = true;
  if (!ch) {
    logger.warn("group_notice_refresh_no_channel");
    errorText.value = t("group_notice_load_failed");
    return;
  }
  currentChannelId.value = ch;
  loading.value = true;
  errorText.value = "";
  try {
    readIds.value = await loadReadIds(ch);
    // 网络能力由 "network" 权限注入；相对路径会被宿主拼接到当前 server origin。
    const res = await getContext().host.network?.fetch(
      `/api/group/notices?channel_id=${encodeURIComponent(ch)}`,
    );
    if (!res || !res.ok) {
      logger.warn("group_notice_fetch_failed", { status: res?.status ?? -1 });
      errorText.value = t("group_notice_load_failed");
      return;
    }
    const parsed = parseGroupNoticesResponse(res.bodyText);
    if (!parsed.ok) {
      logger.warn("group_notice_parse_failed", { error: parsed.error });
      errorText.value = t("group_notice_load_failed");
      return;
    }
    notices.value = parsed.notices;
  } catch (e) {
    logger.error("group_notice_refresh_error", { error: String(e) });
    errorText.value = t("group_notice_load_failed");
  } finally {
    loading.value = false;
  }
}

/** 将当前未读通知全部标记为已读，并持久化游标。 */
async function markAllRead(): Promise<void> {
  const ch = currentChannelId.value;
  if (!ch) return;
  const next = new Set(readIds.value);
  for (const item of notices.value) next.add(item.noticeId);
  readIds.value = next;
  try {
    await getContext().host.storage.set(readIdsStorageKey(ch), Array.from(next));
  } catch (e) {
    logger.warn("group_notice_read_ids_save_failed", { error: String(e) });
  }
}

function close(): void {
  visible.value = false;
}

defineExpose({
  refresh,
});
</script>

<style scoped lang="scss">
// 浮层通知面板：右上角固定定位，区分未读/已读样式。
.group-notice-host {
  position: fixed;
  top: 48px;
  right: 16px;
  z-index: 3000;
}

.group-notice-panel {
  width: 320px;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  background: var(--cp-surface);
  box-shadow: 0 4px 16px rgb(0 0 0 / 15%);
  font-size: 13px;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--cp-border);
    color: var(--cp-text);
  }

  &__title {
    flex: 1;
    font-weight: 600;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__body {
    overflow-y: auto;
    padding: 8px 12px;
  }

  &__hint,
  &__error {
    padding: 16px 0;
    text-align: center;
    color: var(--cp-text-muted, #999);
  }

  &__error {
    color: var(--td-error-color, #d54941);
  }

  &__item {
    padding: 8px 10px;
    margin-bottom: 8px;
    border: 1px solid var(--cp-border);
    border-left-width: 3px;
    border-radius: 6px;

    &--info {
      border-left-color: var(--td-brand-color, #0052d9);
    }

    &--warning {
      border-left-color: var(--td-warning-color, #ed7b2f);
    }

    &--critical {
      border-left-color: var(--td-error-color, #d54941);
    }

    &--unread {
      background: var(--cp-accent-soft, rgb(0 82 217 / 6%));
    }
  }

  &__item-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  &__item-title {
    flex: 1;
    font-weight: 500;
    color: var(--cp-text);
  }

  &__item-badge {
    font-size: 11px;
    color: var(--cp-text-muted, #999);

    &--unread {
      color: var(--td-error-color, #d54941);
      font-weight: 600;
    }
  }

  &__item-body {
    color: var(--cp-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__item-time {
    margin-top: 4px;
    font-size: 11px;
    color: var(--cp-text-muted, #999);
  }
}
</style>
