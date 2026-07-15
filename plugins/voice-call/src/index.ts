import type { Component } from "vue";
import type { PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { voiceCallManifest } from "./manifest";
import { bindContext, onVoiceCallEvent } from "./host/bridge";
import { voiceCallMessages } from "./i18n/messages";
import VoiceCallHost from "./components/VoiceCallHost.vue";
import CallRecordBubble from "./components/CallRecordBubble.vue";
import "./styles/voice-call.scss";

export const manifest = voiceCallManifest;

export const renderers: Record<string, Component> = {
  call_record: CallRecordBubble,
};

let cleanup: (() => void) | null = null;

function t(lang: string, key: string): string {
  const dict =
    (voiceCallMessages as Record<string, Record<string, string>>)[lang] ?? voiceCallMessages.zh_cn;
  return dict[key] ?? key;
}

export function activate(ctx: PluginContext): void {
  bindContext(ctx);
  const lang = ctx.lang || "zh_cn";

  const detach =
    ctx.host.registerToolbarAction?.({
      id: "voice-call.start",
      label: t(lang, "voiceCall.start"),
      order: 50,
      onClick: () => {
        // 发起通话流程：实际参数（target/room）由 chat 上下文提供；此处走 bridge 调后端。
        void ctx.host.invoke?.("voice_call:start_direct_call", {
          sessionId: `local-${Date.now()}`,
          targetUserId: "",
          roomId: "",
        });
      },
    }) ?? (() => {});

  const unmount = ctx.host.mountOverlay?.(VoiceCallHost) ?? (() => {});

  const offIncoming = onVoiceCallEvent("voice_call:incoming", (p) => {
    // 由 VoiceCallHost 内部状态机消费；此处仅确保订阅建立
    void p;
  });
  const offState = onVoiceCallEvent("voice_call:state_change", () => {});
  const offVideo = onVoiceCallEvent("voice_call:video_signaling", () => {});

  cleanup = () => {
    detach();
    unmount();
    offIncoming();
    offState();
    offVideo();
  };
}

export function deactivate(): void {
  cleanup?.();
  cleanup = null;
}
