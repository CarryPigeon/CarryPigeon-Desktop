<script setup lang="ts">
export interface ChannelModelProps {
  cid?: number
  imgUrl: string
  channelName: string
  latestMsg: string
  active?: boolean
  onClick?: () => void
}
const props = defineProps<ChannelModelProps>()
const emit = defineEmits<{
  (e: 'click', payload: MouseEvent): void
}>()

function handleClick(event: MouseEvent) {
  if (props.onClick) {
    props.onClick()
  }
  emit('click', event)
}
</script>

<template>
  <div class="channelModel" :class="[props.active ? 'active' : '']" @click="handleClick">
    <img class="channelImg" :src="props.imgUrl" loading="lazy" alt="Channel Avatar"/>
    <div class="info">
      <div class="nameRow">
        <span class="channelName" :title="props.channelName">{{ props.channelName }}</span>
      </div>
      <p class="latestMsg" :title="props.latestMsg">{{ props.latestMsg }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.channelModel {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  width: 100%;
  height: 72px;
  box-sizing: border-box;
  background-color: transparent;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  &.active {
    background-color: rgba(0, 0, 0, 0.08);
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      height: 60%;
      width: 4px;
      background-color: #0052d9; /* TDesign Brand Blue or similar */
      border-radius: 0 4px 4px 0;
      box-shadow: 0 0 8px rgba(0, 82, 217, 0.6);
    }
  }
}

.channelImg {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 12px;
  flex-shrink: 0;
  background-color: #e0e0e0;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.nameRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.channelName {
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.latestMsg {
  font-size: 14px;
  color: #888;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
</style>