/**
 * @fileoverview voice-call 插件入口（Cordis v2 契约）。
 * @description
 * - 注册 `call_record` domain 渲染器；
 * - 挂载全局通话浮层（VoiceCallHost）并注册工具栏入口（视频/语音/会议）；
 * - 事件订阅兜底：确保连接建立（无副作用）；订阅随插件 fiber 自动取消。
 */

import { h, defineComponent } from "vue";
import { Icon } from "tdesign-vue-next";
import type { Component } from "vue";
import type { PluginChatContext, ToolbarAction } from "@/features/plugins/api-types";
import type { Context } from "@/features/plugins/sdk";
import { voiceCallManifest } from "./manifest";
import { bindContext, onVoiceCallEvent, unbindContext } from "./host/bridge";
import { createLogger } from "./shared/logger";
import VoiceCallHost from "./components/VoiceCallHost.vue";
import CallRecordBubble from "./components/CallRecordBubble.vue";
import "./styles/voice-call.scss";

const logger = createLogger("voice-call:plugin");

export const name = "voice-call";
export const manifest = voiceCallManifest;
export const inject = ["ui", "ipc", "storage", "domains", "server"];

// 通话入口图标：复用宿主 TDesign 全局 Icon 组件（与宿主共享同一运行时实例）。
function makeIcon(name: string): Component {
  return defineComponent({
    name: `VoiceCallToolbarIcon-${name}`,
    render: () => h(Icon, { name }),
  });
}
const VideoCallIcon = makeIcon("video");
const AudioCallIcon = makeIcon("call");
const ConferenceIcon = makeIcon("usergroup");

export function apply(ctx: Context): void {
  bindContext(ctx);
  ctx.on("dispose", () => unbindContext());

  // 消息 domain 渲染器：通话记录气泡。
  ctx.domains.renderer("call_record", CallRecordBubble);

  // 挂载全局通话浮层（VoiceCallHost），并捕获其实例，供工具栏入口转发通话动作。
  // VoiceCallHost 内部持有 useVoiceCall 状态机与事件订阅，是通话 UI 的唯一权威实例。
  const overlayHandle =
    ctx.ui?.mountOverlay(VoiceCallHost, {
      props: { roomId: "", roomName: "", targetUserId: undefined },
    }) ?? { unmount: () => {}, instance: null };

  // 将工具栏点击转发到 VoiceCallHost 的 exposed 方法，携带实时频道上下文（roomId/targetUserId）。
  function startCall(kind: "video" | "audio" | "conference", chatCtx?: PluginChatContext): void {
    const host = overlayHandle.instance as {
      startVideoCall?: (targetUserId: string | undefined, roomId: string) => void;
      startDirectCall?: (targetUserId: string | undefined, roomId: string) => void;
      startConference?: (roomId: string) => void;
    } | null;
    if (!host) {
      logger.warn("voice_call_toolbar_host_missing", { kind });
      return;
    }
    const roomId = chatCtx?.channelId ?? "";
    if (!roomId) {
      logger.warn("voice_call_toolbar_no_channel", { kind });
      return;
    }
    const targetUserId = chatCtx?.targetUserId;
    if (kind === "video") host.startVideoCall?.(targetUserId, roomId);
    else if (kind === "audio") host.startDirectCall?.(targetUserId, roomId);
    else host.startConference?.(roomId);
  }

  const actions: ToolbarAction[] = [
    {
      id: "voice-call.video",
      label: "",
      icon: VideoCallIcon,
      order: 48,
      onClick: (c) => startCall("video", c),
    },
    {
      id: "voice-call.audio",
      label: "",
      icon: AudioCallIcon,
      order: 49,
      onClick: (c) => startCall("audio", c),
    },
    {
      id: "voice-call.conference",
      label: "",
      icon: ConferenceIcon,
      order: 50,
      onClick: (c) => startCall("conference", c),
    },
  ];

  for (const action of actions) ctx.ui?.registerToolbarAction(action);

  // 事件订阅兜底：VoiceCallHost 内部已自行订阅并消费，此处确保连接建立（无副作用）。
  // 订阅随插件 fiber 自动取消。
  onVoiceCallEvent("voice_call:incoming", (p) => void p);
  onVoiceCallEvent("voice_call:state_change", () => {});
  onVoiceCallEvent("voice_call:video_signaling", () => {});
}
