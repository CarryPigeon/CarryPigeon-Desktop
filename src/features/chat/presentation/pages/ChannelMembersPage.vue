<script setup lang="ts">
/**
 * @fileoverview ChannelMembersPage.vue
 * @description chat｜页面：ChannelMembersPage。
 */

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import { CHANNEL_CHANGED_EVENT, type ChannelChangedEventDetail } from "@/shared/utils/messageEvents";
import { listMembers, kickMember, setAdmin, removeAdmin, type ChannelMember } from "@/features/chat/presentation/store/chatStore";
import { currentUser } from "@/features/user/api";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const channelId = computed(() => String(route.query.id ?? "").trim());
const channelName = computed(() => String(route.query.name ?? t("channel_members")).trim());

const members = ref<ChannelMember[]>([]);
const loading = ref(true);
const error = ref("");

const currentUserRole = computed(() => {
  const uid = String(currentUser.id || "").trim();
  const m = members.value.find((x) => x.uid === uid);
  return m?.role ?? "member";
});

const isOwner = computed(() => currentUserRole.value === "owner");
const isAdmin = computed(() => currentUserRole.value === "admin" || currentUserRole.value === "owner");

/**
 * 格式化加入时间戳。
 *
 * @param ms - 加入时间戳（ms）。
 * @returns 日期字符串。
 */
function formatJoinTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString();
}

/**
 * 将 role 值转换为翻译后的标签文案。
 *
 * @param role - 角色值。
 * @returns 本地化后的角色标签。
 */
function roleLabel(role: string): string {
  if (role === "owner") return t("role_owner");
  if (role === "admin") return t("role_admin");
  return t("role_member");
}

/**
 * 加载当前频道成员列表。
 *
 * @returns 无返回值。
 */
async function loadMembers(): Promise<void> {
  if (!channelId.value) return;
  loading.value = true;
  error.value = "";
  try {
    members.value = await listMembers(channelId.value);
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

/**
 * 将成员踢出频道。
 *
 * @param uid - 目标用户 id。
 * @returns 无返回值。
 */
async function handleKick(uid: string): Promise<void> {
  if (!confirm(t("kick_confirm"))) return;
  try {
    await kickMember(channelId.value, uid);
    await loadMembers();
  } catch (e) {
    error.value = String(e);
  }
}

/**
 * 将成员提升为管理员。
 *
 * @param uid - 目标用户 id。
 * @returns 无返回值。
 */
async function handleSetAdmin(uid: string): Promise<void> {
  try {
    await setAdmin(channelId.value, uid);
    await loadMembers();
  } catch (e) {
    error.value = String(e);
  }
}

/**
 * 将管理员降级为成员。
 *
 * @param uid - 目标用户 id。
 * @returns 无返回值。
 */
async function handleRemoveAdmin(uid: string): Promise<void> {
  try {
    await removeAdmin(channelId.value, uid);
    await loadMembers();
  } catch (e) {
    error.value = String(e);
  }
}

/**
 * 处理窗口级频道变更事件：必要时刷新成员列表。
 *
 * @param e - Window 事件。
 */
function handleChannelChanged(e: Event): void {
  const evt = e as CustomEvent<ChannelChangedEventDetail>;
  const detail = evt.detail;
  if (!detail) return;
  if (String(detail.cid ?? "").trim() !== channelId.value) return;
  const scope = String(detail.scope ?? "").trim();
  if (!scope || scope === "members") void loadMembers();
}

/**
 * 组件挂载：加载数据并注册事件监听。
 */
function handleMounted(): void {
  void loadMembers();
  window.addEventListener(CHANNEL_CHANGED_EVENT, handleChannelChanged);
}

/**
 * 组件卸载：移除事件监听。
 */
function handleBeforeUnmount(): void {
  window.removeEventListener(CHANNEL_CHANGED_EVENT, handleChannelChanged);
}

onMounted(handleMounted);
onBeforeUnmount(handleBeforeUnmount);
</script>

<template>
  <!-- 页面：ChannelMembersPage｜职责：频道成员管理 -->
  <main class="cp-members">
    <header class="cp-members__head">
      <button class="cp-members__back" type="button" @click="router.back()">{{ t("back") }}</button>
      <div class="cp-members__title">
        <div class="cp-members__name">{{ channelName }}</div>
        <div class="cp-members__sub">{{ t("channel_members") }} ({{ members.length }})</div>
      </div>
    </header>

    <div v-if="loading" class="cp-members__loading">{{ t("loading") }}</div>
    <div v-else-if="error" class="cp-members__error">{{ error }}</div>

    <section v-else class="cp-members__body">
      <div v-for="m in members" :key="m.uid" class="cp-memberCard">
        <AvatarBadge :name="m.nickname" :size="40" />
        <div class="cp-memberCard__info">
          <div class="cp-memberCard__name">{{ m.nickname }}</div>
          <div class="cp-memberCard__role" :data-role="m.role">{{ roleLabel(m.role) }}</div>
          <div class="cp-memberCard__time">{{ t("joined_at") }}: {{ formatJoinTime(m.joinTime) }}</div>
        </div>
        <div class="cp-memberCard__actions">
          <template v-if="m.role !== 'owner' && m.uid !== currentUser.id">
            <button v-if="isOwner && m.role === 'member'" class="cp-memberCard__btn" type="button" @click="handleSetAdmin(m.uid)">
              {{ t("set_admin") }}
            </button>
            <button v-if="isOwner && m.role === 'admin'" class="cp-memberCard__btn" type="button" @click="handleRemoveAdmin(m.uid)">
              {{ t("remove_admin") }}
            </button>
            <button v-if="isAdmin" class="cp-memberCard__btn danger" type="button" @click="handleKick(m.uid)">
              {{ t("kick_member") }}
            </button>
          </template>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；页面为“头部卡片 + 可滚动成员列表”。 */
.cp-members {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-members__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

.cp-members__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-members__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-members__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-members__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-members__body {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-members__loading,
.cp-members__error {
  padding: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--cp-text-muted);
}

.cp-members__error {
  color: var(--cp-danger);
}

.cp-memberCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-memberCard__info {
  min-width: 0;
}

.cp-memberCard__name {
  font-size: 14px;
  color: var(--cp-text);
  font-weight: 500;
}

.cp-memberCard__role {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-memberCard__role[data-role="owner"] {
  color: var(--cp-accent);
}

.cp-memberCard__role[data-role="admin"] {
  color: var(--cp-info);
}

.cp-memberCard__time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-memberCard__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cp-memberCard__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-memberCard__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-memberCard__btn.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

.cp-memberCard__btn.danger:hover {
  background: color-mix(in oklab, var(--cp-danger) 18%, var(--cp-hover-bg));
}
</style>
