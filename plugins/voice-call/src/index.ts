import { defineComponent } from "vue";
import type { Component } from "vue";
import { voiceCallManifest } from "./manifest";
import "./styles/voice-call.scss";

export const manifest = voiceCallManifest;

// P0 占位渲染器；后续任务迁入真实组件（如 CallRecordBubble）后替换。
// 此处通过 defineComponent 引入 vue 运行期依赖，验证 vue 经 /vendor/vendor.mjs 共享且被 external。
const Placeholder = defineComponent({
  name: "VoiceCallPlaceholder",
  render: () => null,
});

export const renderers: Record<string, Component> = {
  call_record: Placeholder,
};

// 后续任务填充：注册工具栏入口、挂载浮层、订阅 voice_call:* 事件。
export function activate(_ctx: unknown): void {
  // no-op in P0
}

export function deactivate(): void {
  // no-op in P0
}
