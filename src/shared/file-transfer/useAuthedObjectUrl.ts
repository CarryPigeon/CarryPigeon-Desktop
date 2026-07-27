/**
 * @fileoverview useAuthedObjectUrl.ts
 * @description shared/file-transfer｜composable：将受 Bearer 鉴权保护的资源 URL 转换为
 * 可直接用于 `<img>`/`<video>`/`<audio>`/`<object>` 的 objectURL。
 *
 * 背景：
 * - 服务端 `/api/files/download/{shareKey}` 受 Bearer 鉴权保护；
 * - 浏览器原生标签无法附加 `Authorization` header，直接绑定下载 URL 会 401；
 * - 此 composable 用带 `Authorization` 的 fetch 拉取 blob，再用 `URL.createObjectURL`
 *   生成可用 URL，并在依赖变化/组件卸载时自动撤销旧 objectURL。
 */

import { onUnmounted, ref, watch, type Ref } from "vue";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { readAuthToken } from "@/shared/utils/localState";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";

/**
 * 将受 Bearer 鉴权保护的资源 URL 转换为可直接绑定到原生媒体标签的 objectURL。
 *
 * @param urlGetter - 资源 URL 的 getter（返回空字符串时不加载）。
 * @param socketGetter - 服务端 socket 的 getter（用于推导 access token）。
 * @returns objectUrl（绑定到 `:src`）、loading、error。
 */
export function useAuthedObjectUrl(
  urlGetter: () => string,
  socketGetter: () => string,
): {
  objectUrl: Ref<string>;
  loading: Ref<boolean>;
  error: Ref<string>;
} {
  const objectUrl = ref("");
  const loading = ref(false);
  const error = ref("");
  let currentBlobUrl = "";
  let currentReqId = 0;

  async function load(): Promise<void> {
    const reqId = ++currentReqId;
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = "";
    }
    const u = urlGetter();
    if (!u) {
      objectUrl.value = "";
      return;
    }
    // mock 模式或 data/blob URL 无需鉴权，直接使用
    if (USE_MOCK_TRANSPORT || u.startsWith("data:") || u.startsWith("blob:")) {
      objectUrl.value = u;
      return;
    }
    const socket = socketGetter();
    loading.value = true;
    error.value = "";
    try {
      let token = "";
      if (socket) {
        try {
          token = (await ensureValidAccessToken(socket)).trim();
        } catch {
          token = "";
        }
        if (!token) token = readAuthToken(socket).trim();
      }
      if (reqId !== currentReqId) return;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(u, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (reqId !== currentReqId) return;
      currentBlobUrl = URL.createObjectURL(blob);
      objectUrl.value = currentBlobUrl;
    } catch (e) {
      if (reqId !== currentReqId) return;
      error.value = String(e);
      objectUrl.value = "";
    } finally {
      if (reqId === currentReqId) loading.value = false;
    }
  }

  watch([urlGetter, socketGetter], () => {
    void load();
  }, { immediate: true });

  onUnmounted(() => {
    currentReqId++;
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = "";
  });

  return { objectUrl, loading, error };
}
