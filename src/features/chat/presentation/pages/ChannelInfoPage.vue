
<script setup lang="ts">
/**
 * @fileoverview ChannelInfoPage.vue
 * @description chat｜页面：ChannelInfoPage。
 *
 * PRD 对照：
 * - P0-C2 频道资料：owner 可更新频道资料（name/brief/avatar）——此页提供 name/brief 的 mock 编辑入口。
 */

import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { allChannels, applyJoin, channelTab, selectChannel, updateChannelMeta } from "@/features/chat/presentation/store/chatStore";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

/**
 * 从 query 参数读取频道 id。
 *
 * @returns 频道 id。
 */
function computeChannelId(): string {
  return String(route.query.id ?? "").trim();
}

const channelId = computed(computeChannelId);

/**
 * 从 mock store 中按 id 查找频道记录。
 *
 * @param id - 频道 id。
 * @returns 找到则返回频道对象，否则返回 `null`。
 */
function findChannelById(id: string) {
  for (const c of allChannels.value) {
    if (c.id === id) return c;
  }
  return null;
}

/**
 * 获取当前频道模型。
 *
 * @returns 频道模型；未找到时返回 `null`。
 */
function computeChannel() {
  return findChannelById(channelId.value);
}

const channel = computed(computeChannel);

/**
 * 计算本页展示名称（优先使用 store；其次使用 query fallback）。
 *
 * @returns 频道展示名。
 */
function computeName(): string {
  return channel.value?.name ?? String(route.query.name ?? "Channel");
}

/**
 * 计算本页展示简介（优先使用 store；其次使用 query fallback）。
 *
 * @returns 频道简介文本。
 */
function computeBrief(): string {
  return channel.value?.brief ?? String(route.query.bio ?? route.query.description ?? "");
}

const name = computed(computeName);
const brief = computed(computeBrief);

const editing = ref(false);
const draftName = ref("");
const draftBrief = ref("");

/**
 * 进入编辑态，并用当前值初始化草稿字段。
 *
 * @returns 无返回值。
 */
function beginEdit(): void {
  editing.value = true;
  draftName.value = name.value;
  draftBrief.value = brief.value;
}

/**
 * 退出编辑态（不保存）。
 *
 * @returns 无返回值。
 */
function cancelEdit(): void {
  editing.value = false;
}

/**
 * 将频道资料保存到 mock store。
 *
 * @returns 无返回值。
 */
function saveEdit(): void {
  if (!channelId.value) return;
  updateChannelMeta(channelId.value, { name: draftName.value, brief: draftBrief.value });
  editing.value = false;
}

/**
 * 申请加入当前频道（discover 列表内可加入的频道）。
 *
 * @returns 无返回值。
 */
function handleJoin(): void {
  if (!channelId.value) return;
  applyJoin(channelId.value);
}

/**
 * 打开 Patchbay，并尽量聚焦到当前频道。
 *
 * 若用户尚未加入频道：
 * - 仅跳转到 Patchbay，并切换到 Discover tab 由用户完成加入操作。
 *
 * @returns 无返回值。
 */
function openInPatchbay(): void {
  if (channel.value?.joined) {
    selectChannel(channel.value.id);
    void router.push("/chat");
    return;
  }
  channelTab.value = "discover";
  void router.push("/chat");
}

/**
 * watch 源：频道 id。
 *
 * @returns 当前频道 id。
 */
function watchChannelId(): string {
  return channelId.value;
}

/**
 * 切换频道时重置编辑态。
 *
 * @returns 无返回值。
 */
function handleChannelIdChange(): void {
  editing.value = false;
}

watch(
  watchChannelId,
  handleChannelIdChange,
);
</script>

<template>
  <!-- 页面：ChannelInfoPage｜职责：频道信息展示/编辑（mock）｜交互：编辑保存、申请加入、跳转回插线板 -->
  <!-- 区块：<main> .cp-info -->
  <main class="cp-info">
    <header class="cp-info__head">
      <button class="cp-info__back" type="button" @click="router.back()">Back</button>
      <div class="cp-info__title">
        <div class="cp-info__name">{{ name }}</div>
        <div class="cp-info__sub">Channel</div>
      </div>
      <div class="cp-info__headRight">
        <button class="cp-info__btn" type="button" @click="openInPatchbay">{{ t("back_to_patchbay") }}</button>
      </div>
    </header>

    <section class="cp-info__body">
      <div class="cp-info__card">
        <div class="cp-info__k">channel_id</div>
        <div class="cp-info__v"><MonoTag :value="channelId || '—'" :copyable="true" /></div>
      </div>
      <div class="cp-info__card wide">
        <div class="cp-info__k">{{ t("channel_brief") }}</div>
        <div v-if="!editing" class="cp-info__v">{{ brief || t("channel_brief_placeholder") }}</div>
        <div v-else class="cp-info__edit">
          <div class="cp-info__editField">
            <div class="cp-info__editLabel">name</div>
            <t-input v-model="draftName" clearable />
          </div>
          <div class="cp-info__editField">
            <div class="cp-info__editLabel">brief</div>
            <t-textarea v-model="draftBrief" :autosize="{ minRows: 3, maxRows: 6 }" />
          </div>
          <div class="cp-info__editActions">
            <button class="cp-info__btn primary" type="button" @click="saveEdit">{{ t("save") }}</button>
            <button class="cp-info__btn" type="button" @click="cancelEdit">{{ t("cancel") }}</button>
          </div>
        </div>
      </div>
      <div class="cp-info__card wide">
        <div class="cp-info__k">membership</div>
        <div class="cp-info__v">
          <span class="cp-info__pill" :data-ok="Boolean(channel?.joined)">{{ channel?.joined ? "joined" : "not joined" }}</span>
          <button v-if="channel && !channel.joined" class="cp-info__btn primary" type="button" :disabled="channel.joinRequested" @click="handleJoin">
            {{ channel.joinRequested ? t("channel_join_request_sent") : t("apply_join") }}
          </button>
          <button v-if="channel && channel.joined" class="cp-info__btn" type="button" @click="beginEdit">{{ t("edit") }}</button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；主区域为两列网格，部分卡片跨全宽。 */
.cp-info {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-info__head {
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

.cp-info__headRight {
  display: flex;
  justify-content: flex-end;
}

.cp-info__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-info__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-info__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-info__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-info__body {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cp-info__card {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
}

.cp-info__card.wide {
  grid-column: 1 / -1;
}

.cp-info__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-info__v {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}

.cp-info__edit {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-info__editField {
  min-width: 0;
}

.cp-info__editLabel {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-info__editActions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.cp-info__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-info__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-info__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-info__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.cp-info__pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-family: var(--cp-font-mono);
  margin-right: 10px;
}

.cp-info__pill[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel-muted));
  color: var(--cp-text);
}
</style>
