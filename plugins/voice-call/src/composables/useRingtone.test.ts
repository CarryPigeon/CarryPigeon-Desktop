/**
 * @fileoverview useRingtone.test.ts
 * @description 测试 useRingtone 行为：play/stop 状态机、audioElement 替换。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useRingtone } from "./useRingtone";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRingtone", () => {
  it("starts not playing", () => {
    const scope = effectScope();
    scope.run(() => {
      const handle = useRingtone();
      expect(handle.isPlaying()).toBe(false);
      handle.stop();
      expect(handle.isPlaying()).toBe(false);
    });
    scope.stop();
  });

  it("stop() is safe to call when not playing", () => {
    const scope = effectScope();
    scope.run(() => {
      const handle = useRingtone();
      handle.stop();
      handle.stop();
      expect(handle.isPlaying()).toBe(false);
    });
    scope.stop();
  });

  it("setAudioElement stores the element and stops on subsequent stop()", () => {
    const scope = effectScope();
    scope.run(() => {
      const handle = useRingtone();
      const playMock = vi.fn().mockReturnValue(Promise.resolve());
      const pauseMock = vi.fn();
      const el = {
        loop: false,
        currentTime: 99,
        play: playMock,
        pause: pauseMock,
      } as unknown as HTMLAudioElement;
      handle.setAudioElement(el);
      expect(el.loop).toBe(true);
      handle.play();
      expect(playMock).toHaveBeenCalled();
      expect(el.currentTime).toBe(0);
      handle.stop();
      expect(pauseMock).toHaveBeenCalled();
      expect(el.currentTime).toBe(0);
    });
    scope.stop();
  });
});
