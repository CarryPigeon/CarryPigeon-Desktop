/**
 * @fileoverview useRingtone.ts
 * @description 语音通话来电/拨号铃声：使用 WebAudio 合成短促「铃—铃—铃」循环，
 *              避免依赖外部音频资源。如需替换为自定义音频，调用 `setAudioElement`。
 */

import { onScopeDispose, ref } from "vue";

export type RingtoneHandle = {
  /** 启动循环铃声。无音频设备时静默 no-op。 */
  play(): void;
  /** 停止铃声并复位。 */
  stop(): void;
  /** 当前是否正在播放。 */
  isPlaying(): boolean;
  /**
   * 替换为用户提供的 HTMLAudioElement（用真实音频文件替代合成）。
   * 若传入 null 则恢复 WebAudio 合成。
   */
  setAudioElement(el: HTMLAudioElement | null): void;
};

const DEFAULT_PATTERN_MS: number[] = [0, 600, 800, 1400];

export function useRingtone(): RingtoneHandle {
  const playing = ref(false);
  let audioCtx: AudioContext | null = null;
  let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let cycleStart = 0;
  let gainNode: GainNode | null = null;

  function ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (audioCtx) return audioCtx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.18;
      gainNode.connect(audioCtx.destination);
    } catch {
      audioCtx = null;
      gainNode = null;
    }
    return audioCtx;
  }

  function beep(durationMs: number): void {
    const ctx = audioCtx;
    if (!ctx || !gainNode) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    osc.connect(env);
    env.connect(gainNode);
    const now = ctx.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.02);
    env.gain.linearRampToValueAtTime(1, now + durationMs / 1000 - 0.04);
    env.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  function scheduleNextCycle(now: number): void {
    const ctx = audioCtx;
    if (!ctx || !playing.value) return;
    const elapsed = now - cycleStart;
    const nextOffset = DEFAULT_PATTERN_MS.find((ms) => ms > elapsed);
    const delayMs = (nextOffset ?? DEFAULT_PATTERN_MS[0]! + 2000) - elapsed;
    schedulerTimer = setTimeout(() => {
      const stamp = Date.now();
      beep(280);
      if (elapsed >= 2000) {
        cycleStart = stamp;
      }
      scheduleNextCycle(stamp);
    }, Math.max(delayMs, 60));
  }

  function playAudioElement(): void {
    if (!audioEl) return;
    audioEl.currentTime = 0;
    const p = audioEl.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        /* autoplay policy / missing device: silent */
      });
    }
  }

  function startElementLoop(): void {
    if (!audioEl) return;
    if (schedulerTimer) clearTimeout(schedulerTimer);
    cycleStart = Date.now();
    playAudioElement();
    schedulerTimer = setInterval(() => {
      if (!playing.value || !audioEl) return;
      playAudioElement();
    }, 2400);
  }

  function play(): void {
    if (playing.value) return;
    playing.value = true;
    if (audioEl) {
      startElementLoop();
      return;
    }
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
        /* permission denied: silent */
      });
    }
    cycleStart = Date.now();
    beep(280);
    scheduleNextCycle(cycleStart);
  }

  function stop(): void {
    if (!playing.value) {
      if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
      }
      return;
    }
    playing.value = false;
    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
  }

  function setAudioElement(el: HTMLAudioElement | null): void {
    const wasPlaying = playing.value;
    if (wasPlaying) stop();
    audioEl = el;
    if (el) {
      el.loop = true;
    }
    if (wasPlaying) play();
  }

  onScopeDispose(() => {
    stop();
    if (audioCtx) {
      audioCtx.close().catch(() => {
        /* noop */
      });
      audioCtx = null;
    }
  });

  return { play, stop, isPlaying: () => playing.value, setAudioElement };
}
