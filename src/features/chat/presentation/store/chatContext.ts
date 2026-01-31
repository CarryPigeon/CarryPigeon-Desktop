/**
 * @fileoverview chatContext.ts 文件职责说明。
 */
import { ref } from "vue";

const channelId = ref<number>(0);

/**
 * setChannelId 方法说明。
 * @param id - 参数说明。
 * @returns 返回值说明。
 */
export function setChannelId(id: number) {
  channelId.value = id;
}

/**
 * getChannelId 方法说明。
 * @returns 返回值说明。
 */
export function getChannelId() {
  return channelId.value;
}
