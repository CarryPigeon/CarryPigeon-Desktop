/**
 * @fileoverview currentServerState.ts 文件职责说明。
 */
import { ref } from "vue";

/**
 * Exported constant.
 * @constant
 */
export const currentServerSocket = ref<string>("");

/**
 * setServerSocket 方法说明。
 * @param socket - 参数说明。
 * @returns 返回值说明。
 */
export function setServerSocket(socket: string) {
  currentServerSocket.value = socket;
}

/**
 * getServerSocket 方法说明。
 * @returns 返回值说明。
 */
export function getServerSocket(): string {
  return currentServerSocket.value;
}

