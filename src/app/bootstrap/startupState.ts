/**
 * @fileoverview 启动阶段状态，供 main.ts 和 StartupShell.vue 共享，
 * 避免循环依赖。
 */
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
