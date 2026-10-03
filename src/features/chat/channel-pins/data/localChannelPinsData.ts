/**
 * @fileoverview 本地置顶频道数据访问。
 * @description chat/channel-pins｜data：通过 Tauri command 读写本机 JSON，并订阅文件热加载事件。
 */

import type { Event, UnlistenFn } from "@tauri-apps/api/event";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { invokeTauri, safeInvokeTauri } from "@/shared/tauri/invokeClient";
import { listenChannelPinsChanged, type ChannelPinsChangedEvent } from "@/shared/tauri/events";

/**
 * 置顶频道本地状态（与 Rust `ChannelPinsStateV1` 对应）。
 */
export type ChannelPinsState = {
  /** schema 版本号。 */
  schemaVersion: number;
  /** serverSocket -> 置顶频道 ID 列表（有序）。 */
  servers: Record<string, string[]>;
};

/** 空状态常量。 */
export const EMPTY_CHANNEL_PINS_STATE: ChannelPinsState = {
  schemaVersion: 1,
  servers: {},
};

/**
 * 归一化来自 Rust / 事件总线的原始载荷，避免脏数据污染 UI。
 */
function normalizeState(raw: unknown): ChannelPinsState {
  if (!raw || typeof raw !== "object") return { schemaVersion: 1, servers: {} };
  const record = raw as { schemaVersion?: unknown; servers?: unknown };
  const servers: Record<string, string[]> = {};
  if (record.servers && typeof record.servers === "object") {
    for (const [socket, ids] of Object.entries(record.servers as Record<string, unknown>)) {
      if (!Array.isArray(ids)) continue;
      servers[socket] = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
    }
  }
  return {
    schemaVersion: typeof record.schemaVersion === "number" ? record.schemaVersion : 1,
    servers,
  };
}

/**
 * 读取本机置顶状态。Tauri 不可用时静默返回空状态。
 */
export async function loadChannelPins(): Promise<ChannelPinsState> {
  const raw = await safeInvokeTauri<unknown>(TAURI_COMMANDS.channelPinsGet);
  return normalizeState(raw);
}

/**
 * 设置某频道置顶状态，返回写入后的完整状态。
 */
export async function setChannelPinned(
  serverSocket: string,
  channelId: string,
  pinned: boolean,
): Promise<ChannelPinsState> {
  const raw = await invokeTauri<unknown>(TAURI_COMMANDS.channelPinsSet, {
    serverSocket,
    channelId,
    pinned,
  });
  return normalizeState(raw);
}

/**
 * 切换某频道置顶状态，返回写入后的完整状态。
 */
export async function toggleChannelPinned(
  serverSocket: string,
  channelId: string,
): Promise<ChannelPinsState> {
  const raw = await invokeTauri<unknown>(TAURI_COMMANDS.channelPinsToggle, {
    serverSocket,
    channelId,
  });
  return normalizeState(raw);
}

/**
 * 使用系统默认程序打开置顶频道 JSON 文件。
 */
export async function openChannelPinsFile(): Promise<void> {
  await invokeTauri(TAURI_COMMANDS.channelPinsOpenFile);
}

/**
 * 读取置顶频道 JSON 文件绝对路径。Tauri 不可用时返回 `null`。
 */
export async function getChannelPinsFilePath(): Promise<string | null> {
  const path = await safeInvokeTauri<string>(TAURI_COMMANDS.channelPinsFilePath);
  return typeof path === "string" && path.length > 0 ? path : null;
}

/**
 * 订阅本机文件热加载事件。
 */
export function listenChannelPinsFileChanged(
  handler: (state: ChannelPinsState) => void,
): Promise<UnlistenFn> {
  return listenChannelPinsChanged((event: Event<ChannelPinsChangedEvent>) => {
    handler(normalizeState(event.payload));
  });
}
