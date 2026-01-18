<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Dialog, Input } from "tdesign-vue-next";
import ChannelModel from "../components/items/ChannelModel.vue";
import DefaultAvatar from "/test_avatar.jpg?url";
import {
    addChannel,
    hasChannel,
    useChannelStore,
} from "../script/store/channelStore";

// 定义搜索频道的类型结构
type SearchChannel = {
    id?: number;
    channelName: string;
    imgUrl: string;
    latestMsg: string;
};

const router = useRouter();
const { t } = useI18n();

// 获取频道状态存储
const { channels, setActiveChannel } = useChannelStore();

// 推荐的频道列表（硬编码示例，实际可能来自 API）
const suggestedChannels = computed<SearchChannel[]>(() => [
    {
        id: 101,
        channelName: t("channel_announcements"),
        imgUrl: DefaultAvatar,
        latestMsg: t("channel_announcements_desc"),
    },
    {
        id: 102,
        channelName: t("channel_product"),
        imgUrl: DefaultAvatar,
        latestMsg: t("channel_product_desc"),
    },
    {
        id: 103,
        channelName: t("channel_tech_support"),
        imgUrl: DefaultAvatar,
        latestMsg: t("channel_tech_support_desc"),
    },
    {
        id: 104,
        channelName: t("channel_general"),
        imgUrl: DefaultAvatar,
        latestMsg: t("channel_general_desc"),
    },
]);

// 搜索输入框的值
const searchQuery = ref("");
// 当前选中的频道对象
const selected = ref<SearchChannel | null>(null);

// 错误信息和提交状态
const errorMessage = ref<string | null>(null);

// 返回上一页
function goBack(): void {
    router.back();
}

// 规范化查询字符串（去除首尾空格）
const normalizedQuery = computed(() => searchQuery.value.trim());

// 判断查询是否为纯数字 ID
const queryIsId = computed(() => /^\d+$/.test(normalizedQuery.value));
// 如果是 ID 查询，转换为数字
const queryId = computed(() =>
    queryIsId.value ? Number(normalizedQuery.value) : null,
);
// 如果不是 ID 查询，则为名称查询
const queryName = computed(() =>
    queryIsId.value ? "" : normalizedQuery.value,
);

// 构建搜索池：包含已有的频道和推荐频道，去重
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

// 搜索辅助函数：转小写并去除空格
function normalizeForSearch(value: string): string {
    return value.trim().toLowerCase();
}

// 根据查询条件过滤出的频道列表
const matchedChannels = computed<SearchChannel[]>(() => {
    const query = normalizedQuery.value;
    // 如果没有输入查询，显示推荐列表
    if (!query) {
        return suggestedChannels.value;
    }

    // 如果是 ID 查询，精确匹配 ID
    if (queryIsId.value) {
        const id = queryId.value;
        if (id == null) return [];
        return searchPool.value.filter((item) => item.id === id);
    }

    // 名称模糊搜索
    const needle = normalizeForSearch(query);
    if (!needle) return [];

    return searchPool.value.filter((item) =>
        normalizeForSearch(item.channelName).includes(needle),
    );
});

// 监听查询变化，处理选中状态的重置逻辑
watch(normalizedQuery, (value) => {
    // 如果查询为空，重置选中项和错误信息
    if (!value) {
        selected.value = null;
        errorMessage.value = null;
        return;
    }

    // 如果当前没有选中项，清除错误信息
    if (!selected.value) {
        errorMessage.value = null;
        return;
    }

    // 检查当前输入是否仍匹配已选中的项
    const selectedMatchesQuery =
        value === selected.value.channelName ||
        (selected.value.id != null && value === String(selected.value.id));

    // 如果不匹配，取消选中
    if (!selectedMatchesQuery) {
        selected.value = null;
    }

    errorMessage.value = null;
});

// 确认弹窗显示状态
const showConfirmDialog = ref(false);
const showAlreadyJoinedDialog = ref(false);
// 待加入的频道
const channelToJoin = ref<SearchChannel | null>(null);

// 处理用户点击搜索结果项：弹出确认对话框
function selectChannel(item: SearchChannel): void {
    if (hasChannel(item.channelName)) {
        showAlreadyJoinedDialog.value = true;
        return;
    }
    channelToJoin.value = item;
    showConfirmDialog.value = true;
}

// 确认加入频道的逻辑
function handleConfirmJoin() {
    if (channelToJoin.value) {
        // 检查频道是否已存在
        if (hasChannel(channelToJoin.value.channelName)) {
            errorMessage.value = t("channel_already_exists");
            showConfirmDialog.value = false;
            return;
        }

        // 添加频道
        addChannel({
            cid: channelToJoin.value.id,
            channelName: channelToJoin.value.channelName,
            imgUrl: channelToJoin.value.imgUrl,
            latestMsg: channelToJoin.value.latestMsg,
            onClick: () => {},
        });
        // 设置新频道为激活状态
        setActiveChannel(channelToJoin.value.id);
    }
    showConfirmDialog.value = false;
}

// 计算最终要添加的频道名称
const targetName = computed(() => {
    if (selected.value) return selected.value.channelName;
    if (queryName.value) return queryName.value;
    if (queryIsId.value && queryId.value != null)
        return t("channel_with_id", { id: queryId.value });
    return "";
});

// 检查是否已存在同名频道
const isDuplicate = computed(() =>
    targetName.value ? hasChannel(targetName.value) : false,
);
</script>

<template>
    <div class="add-channel-page">
        <button class="back-button" type="button" @click="goBack">
            {{ $t("back") }}
        </button>

        <div class="card">
            <h1 class="title">{{ $t("add_channel") }}</h1>
            <p class="subtitle">{{ $t("search_channel_hint") }}</p>

            <div class="form">
                <div class="field">
                    <div class="label">{{ $t("search_label") }}</div>
                    <Input
                        v-model="searchQuery"
                        :placeholder="$t('search_placeholder')"
                    />
                    <div v-if="targetName" class="selected">
                        <span class="selected-label">{{
                            $t("adding_label")
                        }}</span>
                        <span class="selected-value">{{ targetName }}</span>
                        <span v-if="isDuplicate" class="selected-dup">{{
                            $t("already_exists")
                        }}</span>
                    </div>
                </div>

                <div class="results">
                    <div class="results-head">{{ $t("search_results") }}</div>
                    <div
                        v-if="matchedChannels.length === 0"
                        class="results-empty"
                    >
                        {{ $t("no_results") }}
                    </div>
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
                                :latestMsg="
                                    item.id != null
                                        ? `ID: ${item.id} · ${item.latestMsg}`
                                        : item.latestMsg
                                "
                                :onClick="() => {}"
                            />
                        </button>
                    </div>
                </div>

                <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

                <Dialog
                    v-model:visible="showConfirmDialog"
                    :header="$t('confirm_join_title')"
                    :body="
                        $t('confirm_join_content', {
                            channelName: channelToJoin?.channelName,
                        })
                    "
                    :confirm-btn="$t('confirm')"
                    :cancel-btn="$t('cancel')"
                    destroy-on-close
                    mode="modal"
                    @confirm="handleConfirmJoin"
                    @close="showConfirmDialog = false"
                    @cancel="showConfirmDialog = false"
                />

                <Dialog
                    v-model:visible="showAlreadyJoinedDialog"
                    :header="$t('tips')"
                    :body="$t('channel_joined')"
                    :confirm-btn="$t('confirm')"
                    :cancel-btn="null"
                    destroy-on-close
                    mode="modal"
                    @confirm="showAlreadyJoinedDialog = false"
                    @close="showAlreadyJoinedDialog = false"
                />
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
