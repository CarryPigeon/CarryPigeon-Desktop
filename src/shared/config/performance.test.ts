import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getStoredDiagnosticsEnabled,
  isPerformanceMonitoringEnabled,
  setDiagnosticsEnabled,
} from "./performance";

describe("performance monitoring switch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("getStoredDiagnosticsEnabled", () => {
    it("returns false by default", () => {
      expect(getStoredDiagnosticsEnabled()).toBe(false);
    });

    it("returns true when diagnostics is enabled in localStorage", () => {
      localStorage.setItem("cp_diagnostics_enabled", "true");
      expect(getStoredDiagnosticsEnabled()).toBe(true);
    });

    it("returns false for non-true values in localStorage", () => {
      localStorage.setItem("cp_diagnostics_enabled", "1");
      expect(getStoredDiagnosticsEnabled()).toBe(false);
    });

    it("can be enabled and disabled via setter", () => {
      setDiagnosticsEnabled(true);
      expect(getStoredDiagnosticsEnabled()).toBe(true);
      setDiagnosticsEnabled(false);
      expect(getStoredDiagnosticsEnabled()).toBe(false);
    });
  });

  describe("isPerformanceMonitoringEnabled", () => {
    it("matches dev mode or stored diagnostics state", () => {
      const expected = import.meta.env.DEV || getStoredDiagnosticsEnabled();
      expect(isPerformanceMonitoringEnabled()).toBe(expected);
    });
  });
});
