<script setup lang="ts">
/**
 * @fileoverview ChannelModel.vue 文件职责说明。
 */

import { getOpenInfoWindowUsecase } from "@/features/windows/di/windows.di";
import type { ChannelModelProps } from "../../types/ChannelModelProps";

/**
 * openChannelInfoWindow 方法说明。
 * @param payload - 参数说明。
 * @returns 返回值说明。
 */
function openChannelInfoWindow(payload: { channel: ChannelModelProps }) {
  const query = new URLSearchParams({
    window: "channel-info",
    avatar: payload.channel.imgUrl ?? "",
    name: payload.channel.channelName ?? "",
    bio: payload.channel.bio ?? "",
    owner: String(payload.channel.owner ?? ""),
  }).toString();

  void getOpenInfoWindowUsecase().execute({
    label: "channel-info",
    title: payload.channel.channelName || "Channel Info",
    query,
    width: 420,
    height: 360,
  });
}

const props = defineProps<ChannelModelProps>()
const emit = defineEmits<{
  (e: 'model-click', payload: MouseEvent): void
}>()

/**
 * handleModelClick 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
function handleModelClick(event: MouseEvent) {
  if (props.onClick) {
    props.onClick()
  }
  emit('model-click', event)
}

/**
 * handleAvatarClick 方法说明。
 * @returns 返回值说明。
 */
function handleAvatarClick() {
  openChannelInfoWindow({ channel: props });
}
</script>

<template>
  <!-- 组件：频道条目｜职责：展示频道基本信息并响应点击/头像点击 -->
  <!-- 区块：<div> .channelModel -->
  <div class="channelModel" :class="[props.active ? 'active' : '']" @click="handleModelClick">
    <img class="channelImg" :src="props.imgUrl" loading="lazy" alt="Channel Avatar" @click="handleAvatarClick"/>
    <!-- 区块：<div> .info -->
    <div class="info">
      <!-- 区块：<div> .nameRow -->
      <div class="nameRow">
        <span class="channelName" :title="props.channelName">{{ props.channelName }}</span>
      </div>
      <p class="latestMsg" :title="props.latestMsg">{{ props.latestMsg }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：频道条目布局、选中态与文本省略 */
.channelModel {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  width: calc(100% - 16px);
  height: 52px;
  box-sizing: border-box;
  background-color: transparent;
  transition:
    background-color var(--cp-fast, 160ms) var(--cp-ease, ease),
    transform var(--cp-fast, 160ms) var(--cp-ease, ease);
  border-radius: var(--cp-radius, 14px);
  margin: 2px 6px;

  /* 样式：&:hover */
  &:hover {
    background-color: var(--cp-hover-bg);
    transform: translateY(-1px);
  }

  /* 样式：&.active */
  &.active {
    background:
      linear-gradient(180deg, var(--cp-accent-soft), transparent 72%),
      var(--cp-hover-bg-2);
    position: relative;
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);

    /* 样式：&::before */
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      height: 28px;
      width: 4px;
      background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-2));
      border-radius: 999px;
    }
  }
}

/* 样式：.channelImg */
.channelImg {
  width: 32px;
  height: 32px;
  border-radius: 14px;
  object-fit: cover;
  margin-right: 8px;
  flex-shrink: 0;
  background-color: var(--cp-hover-bg);
}

/* 样式：.info */
.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

/* 样式：.nameRow */
.nameRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1px;
}

/* 样式：.channelName */
.channelName {
  font-size: 13px;
  font-weight: 500;
  color: var(--cp-text, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.latestMsg */
.latestMsg {
  font-size: 11px;
  color: var(--cp-text-muted, #737373);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
</style>
