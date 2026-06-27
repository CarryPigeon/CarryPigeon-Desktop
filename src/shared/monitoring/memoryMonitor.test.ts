import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getMemoryMonitor,
  destroyMemoryMonitor,
} from "./memoryMonitor";
import * as performanceConfig from "@/shared/config/performance";

describe("memory monitor with monitoring disabled", () => {
  beforeEach(() => {
    destroyMemoryMonitor();
    vi.spyOn(performanceConfig, "isPerformanceMonitoringEnabled").mockReturnValue(false);
  });

  afterEach(() => {
    destroyMemoryMonitor();
    vi.restoreAllMocks();
  });

  it("does not start interval when monitoring disabled", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const monitor = getMemoryMonitor();
    monitor.start();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(monitor.getStats().isRunning).toBe(false);
  });

  it("does not stop an interval when monitoring disabled", () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const monitor = getMemoryMonitor();
    monitor.stop();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it("returns a no-op unregister function for callbacks when disabled", () => {
    const monitor = getMemoryMonitor();
    const unregisterCleanup = monitor.registerCleanupCallback(() => {});
    const unregisterStatus = monitor.registerStatusCallback(() => {});
    expect(typeof unregisterCleanup).toBe("function");
    expect(typeof unregisterStatus).toBe("function");
    expect(monitor.getStats().cleanupCallbacksCount).toBe(0);
    expect(monitor.getStats().statusCallbacksCount).toBe(0);
  });

  it("triggerCleanup is a no-op when monitoring disabled", async () => {
    const monitor = getMemoryMonitor();
    await expect(monitor.triggerCleanup()).resolves.toBeUndefined();
  });
});
