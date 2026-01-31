<script setup lang="ts">
/**
 * @fileoverview AddChannelPage.vue 文件职责说明。
 */

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
} from "../store/channelStore";

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
/**
 * goBack 方法说明。
 * @returns 返回值说明。
 */
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
/**
 * normalizeForSearch 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
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
/**
 * selectChannel 方法说明。
 * @param item - 参数说明。
 * @returns 返回值说明。
 */
function selectChannel(item: SearchChannel): void {
    if (hasChannel(item.channelName)) {
        showAlreadyJoinedDialog.value = true;
        return;
    }
    channelToJoin.value = item;
    showConfirmDialog.value = true;
}

// 确认加入频道的逻辑
/**
 * handleConfirmJoin 方法说明。
 * @returns 返回值说明。
 */
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
    <!-- 页面：AddChannelPage｜职责：搜索/推荐频道并发起加入流程 -->
    <!-- 区块：<div> .add-channel-page -->
    <div class="add-channel-page">
        <!-- 区块：<button> -->
        <button class="back-button" type="button" @click="goBack">
            {{ $t("back") }}
        </button>

        <!-- 区块：<div> .card -->
        <div class="card">
            <h1 class="title">{{ $t("add_channel") }}</h1>
            <p class="subtitle">{{ $t("search_channel_hint") }}</p>

            <!-- 区块：<div> .form -->
            <div class="form">
                <!-- 区块：<div> .field -->
                <div class="field">
                    <!-- 区块：<div> .label -->
                    <div class="label">{{ $t("search_label") }}</div>
                    <Input
                        v-model="searchQuery"
                        :placeholder="$t('search_placeholder')"
                    />
                    <!-- 区块：<div> .selected -->
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

                <!-- 区块：<div> .results -->
                <div class="results">
                    <!-- 区块：<div> .results-head -->
                    <div class="results-head">{{ $t("search_results") }}</div>
                    <!-- 区块：<div> -->
                    <div
                        v-if="matchedChannels.length === 0"
                        class="results-empty"
                    >
                        {{ $t("no_results") }}
                    </div>
                    <!-- 区块：<div> .results-list -->
                    <div v-else class="results-list">
                        <!-- 区块：<button> -->
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
/* 样式：全屏加入频道页；结构：返回按钮 + 内容卡片 */
.add-channel-page {
    position: relative;
    width: 100vw;
    height: 100vh;
    background: transparent;
    padding: 22px;
    box-sizing: border-box;
}

/* 样式：.back-button */
.back-button {
    position: absolute;
    left: 22px;
    top: 22px;
    border: 1px solid var(--cp-border-light);
    background: rgba(255, 253, 248, 0.62);
    font-size: 14px;
    color: var(--cp-text);
    cursor: pointer;
    font-weight: 500;
    transition:
        transform var(--cp-fast, 160ms) var(--cp-ease, ease),
        background-color var(--cp-fast, 160ms) var(--cp-ease, ease);
    z-index: 2;
    padding: 8px 12px;
    border-radius: 999px;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);

    /* 样式：&:hover */
    &:hover {
        transform: translateY(-1px);
        background: rgba(255, 253, 248, 0.78);
    }
}

/* 样式：.card */
.card {
    width: min(980px, calc(100vw - 44px));
    height: min(720px, calc(100vh - 70px));
    margin: 24px auto 0;
    background: rgba(255, 253, 248, 0.78);
    border-radius: 26px;
    box-shadow: var(--cp-shadow);
    border: 1px solid var(--cp-border);
    padding: 22px 22px 22px;
    box-sizing: border-box;
    overflow: hidden;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    animation: cp-fade-up 360ms var(--cp-ease, ease) both;
}

/* 样式：.title */
.title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--cp-text);
}

/* 样式：.subtitle */
.subtitle {
    margin: 10px 0 18px;
    color: var(--cp-text-muted);
    font-size: 14px;
}

/* 样式：.form */
.form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: calc(100% - 64px);
}

/* 样式：.field */
.field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* 样式：.label */
.label {
    font-size: 14px;
    font-weight: 600;
    color: var(--cp-text);
}

/* 样式：.selected */
.selected {
    font-size: 13px;
    color: var(--cp-text);
}

/* 样式：.selected-label */
.selected-label {
    color: var(--cp-text-muted);
}

/* 样式：.selected-value */
.selected-value {
    font-weight: 700;
    color: var(--cp-text);
}

/* 样式：.selected-dup */
.selected-dup {
    margin-left: 6px;
    color: #ef4444;
}

/* 样式：.results */
.results {
    border: 1px solid var(--cp-border-light);
    border-radius: var(--cp-radius, 14px);
    background: rgba(255, 253, 248, 0.70);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
}

/* 样式：.results-head */
.results-head {
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 700;
    color: var(--cp-text);
    background: rgba(20, 32, 29, 0.03);
    border-bottom: 1px solid var(--cp-border-light);
}

/* 样式：.results-list */
.results-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}

/* 样式：.result-item */
.result-item {
    padding: 0;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;

    /* 样式：&:hover */
    &:hover {
        background: rgba(15, 118, 110, 0.10);
    }
}

/* 样式：.results-empty */
.results-empty {
    padding: 14px 12px;
    font-size: 13px;
    color: var(--cp-text-muted);
}

/* 样式：.error */
.error {
    margin: 0;
    color: #ef4444;
    font-size: 13px;
}

/* 样式：.actions */
.actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.primary,
/* 样式：.secondary */
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

/* 样式：.primary */
.primary {
    background: linear-gradient(135deg, #0f766e 0%, #14b8a6 70%, #34d399 100%);
    color: #fff7ed;

    /* 样式：&:hover */
    &:hover {
        background: #0f766e;
    }

    /* 样式：&:disabled */
    &:disabled {
        background: rgba(15, 118, 110, 0.45);
        cursor: not-allowed;
    }
}

/* 样式：.secondary */
.secondary {
    background: rgba(255, 255, 255, 0.94);
    border-color: rgba(15, 118, 110, 0.18);
    color: var(--cp-text);

    /* 样式：&:hover */
    &:hover {
        background: rgba(15, 118, 110, 0.06);
    }
}
</style>
