<script setup lang="ts">
/**
 * @fileoverview JoinApplicationsPage.vue
 * @description Channel join applications management page.
 */

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import { CHANNEL_CHANGED_EVENT, type ChannelChangedEventDetail } from "@/shared/utils/messageEvents";
import { listApplications, decideApplication, type ChannelApplication } from "@/features/chat/presentation/store/chatStore";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const channelId = computed(() => String(route.query.id ?? "").trim());
const channelName = computed(() => String(route.query.name ?? t("join_applications")).trim());

const applications = ref<ChannelApplication[]>([]);
const loading = ref(true);
const error = ref("");

/**
 * Format apply timestamp.
 *
 * @param ms - Apply timestamp (ms).
 * @returns Date/time string.
 */
function formatApplyTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

/**
 * Load pending applications for the selected channel.
 *
 * @returns Promise<void>.
 */
async function loadApplications(): Promise<void> {
  if (!channelId.value) return;
  loading.value = true;
  error.value = "";
  try {
    applications.value = await listApplications(channelId.value);
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

/**
 * Decide (approve/reject) an application.
 *
 * @param applicationId - Application id.
 * @param approved - Whether to approve.
 * @returns Promise<void>.
 */
async function handleDecide(applicationId: string, approved: boolean): Promise<void> {
  try {
    await decideApplication(channelId.value, applicationId, approved);
    await loadApplications();
  } catch (e) {
    error.value = String(e);
  }
}

const pendingApplications = computed(() => applications.value.filter((a) => a.status === "pending"));

/**
 * Handle window-level channel changed events and refresh applications when needed.
 *
 * @param e - Window event.
 */
function handleChannelChanged(e: Event): void {
  const evt = e as CustomEvent<ChannelChangedEventDetail>;
  const detail = evt.detail;
  if (!detail) return;
  if (String(detail.cid ?? "").trim() !== channelId.value) return;
  const scope = String(detail.scope ?? "").trim();
  if (!scope || scope === "applications") void loadApplications();
}

/**
 * Component mount hook: load data and register event listeners.
 */
function handleMounted(): void {
  void loadApplications();
  window.addEventListener(CHANNEL_CHANGED_EVENT, handleChannelChanged);
}

/**
 * Component unmount hook: remove event listeners.
 */
function handleBeforeUnmount(): void {
  window.removeEventListener(CHANNEL_CHANGED_EVENT, handleChannelChanged);
}

onMounted(handleMounted);
onBeforeUnmount(handleBeforeUnmount);
</script>

<template>
  <!-- 页面：JoinApplicationsPage｜职责：入群申请管理 -->
  <main class="cp-apps">
    <header class="cp-apps__head">
      <button class="cp-apps__back" type="button" @click="router.back()">{{ t("back") }}</button>
      <div class="cp-apps__title">
        <div class="cp-apps__name">{{ channelName }}</div>
        <div class="cp-apps__sub">{{ t("join_applications") }} ({{ pendingApplications.length }})</div>
      </div>
    </header>

    <div v-if="loading" class="cp-apps__loading">{{ t("loading") }}</div>
    <div v-else-if="error" class="cp-apps__error">{{ error }}</div>

    <section v-else class="cp-apps__body">
      <div v-if="pendingApplications.length === 0" class="cp-apps__empty">{{ t("no_applications") }}</div>
      <div v-for="a in pendingApplications" :key="a.applicationId" class="cp-appCard">
        <AvatarBadge :name="a.nickname || a.uid" :size="40" />
        <div class="cp-appCard__info">
          <div class="cp-appCard__name">{{ a.nickname || a.uid }}</div>
          <div class="cp-appCard__reason">
            <span class="cp-appCard__label">{{ t("application_reason") }}:</span>
            {{ a.reason || "—" }}
          </div>
          <div class="cp-appCard__time">{{ t("applied_at") }}: {{ formatApplyTime(a.applyTime) }}</div>
        </div>
        <div class="cp-appCard__actions">
          <button class="cp-appCard__btn approve" type="button" @click="handleDecide(a.applicationId, true)">
            {{ t("approve") }}
          </button>
          <button class="cp-appCard__btn reject" type="button" @click="handleDecide(a.applicationId, false)">
            {{ t("reject") }}
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* JoinApplicationsPage styles */
.cp-apps {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-apps__head {
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

.cp-apps__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-apps__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-apps__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-apps__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-apps__body {
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

.cp-apps__loading,
.cp-apps__error,
.cp-apps__empty {
  padding: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--cp-text-muted);
}

.cp-apps__error {
  color: var(--cp-danger);
}

.cp-appCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: start;
}

.cp-appCard__info {
  min-width: 0;
}

.cp-appCard__name {
  font-size: 14px;
  color: var(--cp-text);
  font-weight: 500;
}

.cp-appCard__reason {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.4;
}

.cp-appCard__label {
  color: var(--cp-text-muted);
}

.cp-appCard__time {
  margin-top: 6px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-appCard__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-appCard__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-appCard__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-appCard__btn.approve {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 10%, var(--cp-panel-muted));
}

.cp-appCard__btn.approve:hover {
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

.cp-appCard__btn.reject {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

.cp-appCard__btn.reject:hover {
  background: color-mix(in oklab, var(--cp-danger) 18%, var(--cp-hover-bg));
}
</style>
