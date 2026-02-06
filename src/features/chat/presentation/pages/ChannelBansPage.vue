<script setup lang="ts">
/**
 * @fileoverview ChannelBansPage.vue
 * @description chat｜页面：ChannelBansPage。
 */

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import { CHANNEL_CHANGED_EVENT, type ChannelChangedEventDetail } from "@/shared/utils/messageEvents";
import { listBans, listMembers, setBan, removeBan, type ChannelBan, type ChannelMember } from "@/features/chat/presentation/store/chatStore";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const channelId = computed(() => String(route.query.id ?? "").trim());
const channelName = computed(() => String(route.query.name ?? t("channel_bans")).trim());

const bans = ref<ChannelBan[]>([]);
const members = ref<ChannelMember[]>([]);
const loading = ref(true);
const error = ref("");

const showAddBan = ref(false);
const selectedUid = ref("");
const banDuration = ref("1d");
const banReason = ref("");

const durationOptions = [
  { value: "1h", label: "duration_1h", ms: 1000 * 60 * 60 },
  { value: "1d", label: "duration_1d", ms: 1000 * 60 * 60 * 24 },
  { value: "7d", label: "duration_7d", ms: 1000 * 60 * 60 * 24 * 7 },
  { value: "30d", label: "duration_30d", ms: 1000 * 60 * 60 * 24 * 30 },
  { value: "perm", label: "ban_permanent", ms: 0 },
];

/**
 * 格式化禁言截止时间。
 *
 * @param ms - 时间戳（毫秒）。`0` 表示永久禁言。
 * @returns 面向用户显示的时间字符串。
 */
function formatBanUntil(ms: number): string {
  if (!ms || ms === 0) return t("ban_permanent");
  return new Date(ms).toLocaleString();
}

/**
 * 加载当前频道的禁言列表与成员列表。
 *
 * @returns 无返回值。
 */
async function loadData(): Promise<void> {
  if (!channelId.value) return;
  loading.value = true;
  error.value = "";
  try {
    const [banList, memberList] = await Promise.all([
      listBans(channelId.value),
      listMembers(channelId.value),
    ]);
    bans.value = banList;
    members.value = memberList;
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

const bannableMembers = computed(() => {
  const bannedUids = new Set(bans.value.map((b) => b.uid));
  return members.value.filter((m) => m.role !== "owner" && !bannedUids.has(m.uid));
});

/**
 * 新增禁言。
 *
 * @returns 无返回值。
 */
async function handleAddBan(): Promise<void> {
  if (!selectedUid.value) return;
  const opt = durationOptions.find((d) => d.value === banDuration.value);
  const until = opt?.ms === 0 ? 0 : Date.now() + (opt?.ms ?? 0);
  try {
    await setBan(channelId.value, selectedUid.value, until, banReason.value);
    showAddBan.value = false;
    selectedUid.value = "";
    banDuration.value = "1d";
    banReason.value = "";
    await loadData();
  } catch (e) {
    error.value = String(e);
  }
}

/**
 * 解除禁言。
 *
 * @param uid - 目标用户 id。
 * @returns 无返回值。
 */
async function handleRemoveBan(uid: string): Promise<void> {
  try {
    await removeBan(channelId.value, uid);
    await loadData();
  } catch (e) {
    error.value = String(e);
  }
}

/**
 * 处理窗口级频道变更事件：当目标频道的禁言状态可能变化时刷新。
 *
 * @param e - 窗口事件。
 */
function handleChannelChanged(e: Event): void {
  const evt = e as CustomEvent<ChannelChangedEventDetail>;
  const detail = evt.detail;
  if (!detail) return;
  if (String(detail.cid ?? "").trim() !== channelId.value) return;
  const scope = String(detail.scope ?? "").trim();
  if (!scope || scope === "bans") void loadData();
}

/**
 * 组件挂载：加载数据并注册事件监听。
 */
function handleMounted(): void {
  void loadData();
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
  <!-- 页面：ChannelBansPage｜职责：频道封禁管理 -->
  <main class="cp-bans">
    <header class="cp-bans__head">
      <button class="cp-bans__back" type="button" @click="router.back()">{{ t("back") }}</button>
      <div class="cp-bans__title">
        <div class="cp-bans__name">{{ channelName }}</div>
        <div class="cp-bans__sub">{{ t("channel_bans") }} ({{ bans.length }})</div>
      </div>
      <div class="cp-bans__actions">
        <button class="cp-bans__btn primary" type="button" @click="showAddBan = true">{{ t("add_ban") }}</button>
      </div>
    </header>

    <div v-if="loading" class="cp-bans__loading">{{ t("loading") }}</div>
    <div v-else-if="error" class="cp-bans__error">{{ error }}</div>

    <section v-else class="cp-bans__body">
      <div v-if="bans.length === 0" class="cp-bans__empty">{{ t("no_bans") }}</div>
      <div v-for="b in bans" :key="b.uid" class="cp-banCard">
        <AvatarBadge :name="b.nickname || b.uid" :size="40" />
        <div class="cp-banCard__info">
          <div class="cp-banCard__name">{{ b.nickname || b.uid }}</div>
          <div class="cp-banCard__reason">
            <span class="cp-banCard__label">{{ t("ban_reason") }}:</span>
            {{ b.reason || "—" }}
          </div>
          <div class="cp-banCard__until">{{ t("ban_until") }}: {{ formatBanUntil(b.until) }}</div>
        </div>
        <div class="cp-banCard__actions">
          <button class="cp-banCard__btn" type="button" @click="handleRemoveBan(b.uid)">
            {{ t("remove_ban") }}
          </button>
        </div>
      </div>
    </section>

    <!-- Add Ban Dialog -->
    <t-dialog v-model:visible="showAddBan" :header="t('add_ban')" :footer="false">
      <div class="cp-addBan">
        <div class="cp-addBan__field">
          <label class="cp-addBan__label">{{ t("select_user") }}</label>
          <t-select v-model="selectedUid" :placeholder="t('select_user')">
            <t-option v-for="m in bannableMembers" :key="m.uid" :value="m.uid" :label="m.nickname" />
          </t-select>
        </div>
        <div class="cp-addBan__field">
          <label class="cp-addBan__label">{{ t("ban_duration") }}</label>
          <t-select v-model="banDuration">
            <t-option v-for="d in durationOptions" :key="d.value" :value="d.value" :label="t(d.label)" />
          </t-select>
        </div>
        <div class="cp-addBan__field">
          <label class="cp-addBan__label">{{ t("ban_reason") }}</label>
          <t-textarea v-model="banReason" :placeholder="t('ban_reason')" :autosize="{ minRows: 2, maxRows: 4 }" />
        </div>
        <div class="cp-addBan__actions">
          <button class="cp-addBan__btn" type="button" @click="showAddBan = false">{{ t("cancel") }}</button>
          <button class="cp-addBan__btn primary" type="button" :disabled="!selectedUid" @click="handleAddBan">{{ t("confirm") }}</button>
        </div>
      </div>
    </t-dialog>
  </main>
</template>

<style scoped lang="scss">
/* ChannelBansPage styles */
.cp-bans {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-bans__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-bans__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-bans__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-bans__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-bans__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-bans__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-bans__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-bans__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-bans__body {
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

.cp-bans__loading,
.cp-bans__error,
.cp-bans__empty {
  padding: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--cp-text-muted);
}

.cp-bans__error {
  color: var(--cp-danger);
}

.cp-banCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-banCard__info {
  min-width: 0;
}

.cp-banCard__name {
  font-size: 14px;
  color: var(--cp-text);
  font-weight: 500;
}

.cp-banCard__reason {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.4;
}

.cp-banCard__label {
  color: var(--cp-text-muted);
}

.cp-banCard__until {
  margin-top: 6px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-banCard__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-banCard__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-addBan {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cp-addBan__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-addBan__label {
  font-size: 12px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-addBan__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cp-addBan__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-addBan__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-addBan__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-addBan__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
