<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Input } from "tdesign-vue-next";
import ChannelModel from "../components/items/ChannelModel.vue";
import DefaultAvatar from "/test_avatar.jpg?url";
import { addChannel, hasChannel, useChannelStore } from "../script/store/channelStore";

type SearchChannel = {
  id?: number;
  channelName: string;
  imgUrl: string;
  latestMsg: string;
};

const router = useRouter();
const { t } = useI18n();

const { channels } = useChannelStore();

const suggestedChannels = computed<SearchChannel[]>(() => [
  { id: 1, channelName: t('channel_announcements'), imgUrl: DefaultAvatar, latestMsg: t('channel_announcements_desc') },
  { id: 2, channelName: t('channel_product'), imgUrl: DefaultAvatar, latestMsg: t('channel_product_desc') },
  { id: 3, channelName: t('channel_tech_support'), imgUrl: DefaultAvatar, latestMsg: t('channel_tech_support_desc') },
  { id: 4, channelName: t('channel_general'), imgUrl: DefaultAvatar, latestMsg: t('channel_general_desc') },
]);

const searchQuery = ref("");
const selected = ref<SearchChannel | null>(null);

const errorMessage = ref<string | null>(null);
const submitting = ref(false);

function goBack(): void {
  router.back();
}

const normalizedQuery = computed(() => searchQuery.value.trim());

const queryIsId = computed(() => /^\d+$/.test(normalizedQuery.value));
const queryId = computed(() => (queryIsId.value ? Number(normalizedQuery.value) : null));
const queryName = computed(() => (queryIsId.value ? "" : normalizedQuery.value));

const searchPool = computed<SearchChannel[]>(() => {
  const fromStore: SearchChannel[] = channels.map((item) => ({
    id: item.cid,
    channelName: item.channelName,
    imgUrl: item.imgUrl,
    latestMsg: item.latestMsg,
  }));

  const nameSet = new Set<string>();
  const merged: SearchChannel[] = [];

  for (const item of [...fromStore, ...suggestedChannels.value]) {
    const name = item.channelName.trim();
    if (!name) continue;
    if (nameSet.has(name)) continue;
    nameSet.add(name);
    merged.push(item);
  }

  return merged;
});

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

const matchedChannels = computed<SearchChannel[]>(() => {
  const query = normalizedQuery.value;
  if (!query) {
    return suggestedChannels.value;
  }

  if (queryIsId.value) {
    const id = queryId.value;
    if (id == null) return [];
    return searchPool.value.filter((item) => item.id === id);
  }

  const needle = normalizeForSearch(query);
  if (!needle) return [];

  return searchPool.value.filter((item) => normalizeForSearch(item.channelName).includes(needle));
});

watch(normalizedQuery, (value) => {
  if (!value) {
    selected.value = null;
    errorMessage.value = null;
    return;
  }

  if (!selected.value) {
    errorMessage.value = null;
    return;
  }

  const selectedMatchesQuery =
    value === selected.value.channelName ||
    (selected.value.id != null && value === String(selected.value.id));

  if (!selectedMatchesQuery) {
    selected.value = null;
  }

  errorMessage.value = null;
});

function selectChannel(item: SearchChannel): void {
  selected.value = item;
  searchQuery.value = item.channelName;
}

const targetName = computed(() => {
  if (selected.value) return selected.value.channelName;
  if (queryName.value) return queryName.value;
  if (queryIsId.value && queryId.value != null) return `频道 #${queryId.value}`;
  return "";
});

const isDuplicate = computed(() => (targetName.value ? hasChannel(targetName.value) : false));

const canSubmit = computed(
  () => targetName.value.trim().length > 0 && !isDuplicate.value && !submitting.value,
);

async function onSubmit(): Promise<void> {
  errorMessage.value = null;

  const name = targetName.value.trim();
  if (!name) {
    errorMessage.value = t('enter_channel_name_or_id');
    return;
  }

  if (hasChannel(name)) {
    errorMessage.value = t('channel_already_exists');
    return;
  }

  submitting.value = true;
  try {
    const idHint = queryIsId.value && queryId.value != null ? `ID: ${queryId.value}` : "";

    addChannel({
      cid: selected.value?.id ?? (queryIsId.value && queryId.value != null ? queryId.value : undefined),
      channelName: name,
      imgUrl: selected.value?.imgUrl ?? DefaultAvatar,
      latestMsg: selected.value?.latestMsg ?? idHint ?? "",
      onClick: () => {},
    });

    router.back();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="add-channel-page">
    <button class="back-button" type="button" @click="goBack">{{ $t('back') }}</button>

    <div class="card">
      <h1 class="title">{{ $t('add_channel') }}</h1>
      <p class="subtitle">{{ $t('search_channel_hint') }}</p>

      <div class="form">
        <div class="field">
          <div class="label">{{ $t('search_label') }}</div>
          <Input v-model="searchQuery" :placeholder="$t('search_placeholder')" />
          <div v-if="targetName" class="selected">
            <span class="selected-label">{{ $t('adding_label') }}</span>
            <span class="selected-value">{{ targetName }}</span>
            <span v-if="isDuplicate" class="selected-dup">{{ $t('already_exists') }}</span>
          </div>
        </div>

        <div class="results">
          <div class="results-head">{{ $t('search_results') }}</div>
          <div v-if="matchedChannels.length === 0" class="results-empty">{{ $t('no_results') }}</div>
          <div v-else class="results-list">
            <button
              v-for="item in matchedChannels"
              :key="`${item.id ?? 'name'}-${item.channelName}`"
              class="result-item"
              type="button"
              @click="selectChannel(item)"
            >
              <ChannelModel
                :imgUrl="item.imgUrl"
                :channelName="item.channelName"
                :latestMsg="item.id != null ? `ID: ${item.id} · ${item.latestMsg}` : item.latestMsg"
                :onClick="() => {}"
              />
            </button>
          </div>
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <div class="actions">
          <button class="secondary" type="button" @click="goBack">{{ $t('cancel') }}</button>
          <button class="primary" type="button" :disabled="!canSubmit" @click="onSubmit">
            {{ submitting ? $t('loading') : $t('add') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.add-channel-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #f5f7fa;
}

.back-button {
  position: absolute;
  left: 20px;
  bottom: 20px;
  border: none;
  background: transparent;
  font-size: 16px;
  color: #3b82f6;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s ease;
  z-index: 2;

  &:hover {
    color: #2563eb;
  }
}

.card {
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 0;
  box-shadow: none;
  padding: 24px 24px 64px;
  box-sizing: border-box;
  overflow: hidden;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}

.subtitle {
  margin: 10px 0 18px;
  color: #6b7280;
  font-size: 14px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: calc(100% - 56px);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.selected {
  font-size: 13px;
  color: #374151;
}

.selected-label {
  color: #6b7280;
}

.selected-value {
  font-weight: 700;
  color: #111827;
}

.selected-dup {
  margin-left: 6px;
  color: #ef4444;
}

.results {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.results-head {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.results-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.result-item {
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgba(59, 130, 246, 0.08);
  }
}

.results-empty {
  padding: 14px 12px;
  font-size: 13px;
  color: #6b7280;
}

.error {
  margin: 0;
  color: #ef4444;
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.primary,
.secondary {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary {
  background: #3b82f6;
  color: white;

  &:hover {
    background: #2563eb;
  }

  &:disabled {
    background: rgba(59, 130, 246, 0.45);
    cursor: not-allowed;
  }
}

.secondary {
  background: white;
  border-color: #e5e7eb;
  color: #374151;

  &:hover {
    background: #f9fafb;
  }
}
</style>
