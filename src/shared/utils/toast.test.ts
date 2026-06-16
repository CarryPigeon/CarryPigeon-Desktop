/**
 * @fileoverview toast 工具单元测试
 */

import { describe, expect, it, vi } from "vitest";

// Mock MessagePlugin before importing
vi.mock("tdesign-vue-next", () => ({
  MessagePlugin: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("toast", () => {
  it("should export success/warning/error/info/fromError/copied methods", async () => {
    const { toast } = await import("./toast");
    expect(typeof toast.success).toBe("function");
    expect(typeof toast.warning).toBe("function");
    expect(typeof toast.error).toBe("function");
    expect(typeof toast.info).toBe("function");
    expect(typeof toast.fromError).toBe("function");
    expect(typeof toast.copied).toBe("function");
  });

  it("should call MessagePlugin.success on toast.success", async () => {
    const { MessagePlugin } = await import("tdesign-vue-next");
    const { toast } = await import("./toast");
    toast.success("Done");
    expect(MessagePlugin.success).toHaveBeenCalledWith("Done");
  });

  it("should call MessagePlugin.error on toast.error", async () => {
    const { MessagePlugin } = await import("tdesign-vue-next");
    const { toast } = await import("./toast");
    toast.error("Oops");
    expect(MessagePlugin.error).toHaveBeenCalledWith("Oops");
  });

  it("toast.fromError should handle Error instances", async () => {
    const { MessagePlugin } = await import("tdesign-vue-next");
    const { toast } = await import("./toast");
    toast.fromError(new Error("Network error"));
    expect(MessagePlugin.error).toHaveBeenCalledWith("Network error");
  });

  it("toast.fromError should handle string errors", async () => {
    const { MessagePlugin } = await import("tdesign-vue-next");
    const { toast } = await import("./toast");
    toast.fromError("Something went wrong");
    expect(MessagePlugin.error).toHaveBeenCalledWith("Something went wrong");
  });

  it("toast.fromError should use fallback when error is empty", async () => {
    const { MessagePlugin } = await import("tdesign-vue-next");
    const { toast } = await import("./toast");
    // Reset mock to check fallback
    vi.clearAllMocks();
    toast.fromError("", "Default error message");
    expect(MessagePlugin.error).toHaveBeenCalledWith("Default error message");
  });
});
