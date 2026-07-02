/**
 * @fileoverview 启动阶段状态，供 main.ts 和 StartupShell.vue 共享，
 * 避免循环依赖。
 */
import { ref } from "vue";

export type StartupPhase = 'initializing' | 'ready' | 'failed';

let resolve: ((phase: StartupPhase) => void) | null = null;

export const startupPromise = new Promise<StartupPhase>((r) => {
  resolve = r;
});

export function resolveStartup(phase: StartupPhase): void {
  if (resolve) {
    resolve(phase);
    resolve = null;
  }
}

/**
 * 当前启动阶段文案对应的 i18n 键。
 * 由初始化流程写入，StartupShell 读取并翻译展示。
 */
export const startupPhaseLabel = ref<string>("");

/**
 * 设置启动阶段文案键。
 */
export function setStartupPhaseLabel(label: string): void {
  startupPhaseLabel.value = label;
}
