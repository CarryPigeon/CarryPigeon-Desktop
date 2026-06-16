/**
 * @fileoverview AuthErrors 单元测试
 */

import { describe, expect, it } from "vitest";
import {
  AuthError,
  AuthRequiredPluginMissingError,
  isAuthError,
  isAuthRequiredPluginMissingError,
  toAuthErrorMessage,
} from "./AuthErrors";

describe("AuthError", () => {
  it("should create an AuthError with correct properties", () => {
    const err = new AuthError({
      code: "login_failed",
      message: "Login failed",
      status: 401,
      reason: "invalid_credentials",
      details: { field: "email" },
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AuthError");
    expect(err.code).toBe("login_failed");
    expect(err.status).toBe(401);
    expect(err.reason).toBe("invalid_credentials");
    expect(err.details).toEqual({ field: "email" });
  });

  it("should default status to null and reason to empty string", () => {
    const err = new AuthError({ code: "missing_email", message: "Missing email" });
    expect(err.status).toBeNull();
    expect(err.reason).toBe("");
    expect(err.details).toEqual({});
  });
});

describe("AuthRequiredPluginMissingError", () => {
  it("should carry missing_plugins payload", () => {
    const err = new AuthRequiredPluginMissingError({
      reason: "required_plugin_missing",
      missing_plugins: ["com.example.math", "com.example.mc"],
    });

    expect(err.code).toBe("required_plugin_missing");
    expect(err.payload.missing_plugins).toEqual(["com.example.math", "com.example.mc"]);
    expect(err.message).toContain("com.example.math");
    expect(err.message).toContain("com.example.mc");
  });
});

describe("isAuthError", () => {
  it("should return true for AuthError instances", () => {
    const err = new AuthError({ code: "send_code_failed", message: "Send code failed" });
    expect(isAuthError(err)).toBe(true);
  });

  it("should return true for AuthRequiredPluginMissingError (subclass)", () => {
    const err = new AuthRequiredPluginMissingError({
      reason: "required_plugin_missing",
      missing_plugins: ["test.plugin"],
    });
    expect(isAuthError(err)).toBe(true);
  });

  it("should return false for plain Error", () => {
    expect(isAuthError(new Error("generic"))).toBe(false);
  });

  it("should return false for non-Error values", () => {
    expect(isAuthError("string")).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe("isAuthRequiredPluginMissingError", () => {
  it("should return true for the specific subclass", () => {
    const err = new AuthRequiredPluginMissingError({
      reason: "required_plugin_missing",
      missing_plugins: [],
    });
    expect(isAuthRequiredPluginMissingError(err)).toBe(true);
  });

  it("should return false for base AuthError", () => {
    const err = new AuthError({ code: "login_failed", message: "x" });
    expect(isAuthRequiredPluginMissingError(err)).toBe(false);
  });
});

describe("toAuthErrorMessage", () => {
  it("should format required plugin missing error", () => {
    const err = new AuthRequiredPluginMissingError({
      reason: "required_plugin_missing",
      missing_plugins: ["a.b", "c.d"],
    });
    const msg = toAuthErrorMessage(err);
    expect(msg).toContain("a.b");
    expect(msg).toContain("c.d");
  });

  it("should map known error codes", () => {
    expect(toAuthErrorMessage(new AuthError({ code: "missing_server_socket", message: "x" }))).toBe(
      "Missing server socket.",
    );
    expect(toAuthErrorMessage(new AuthError({ code: "missing_token", message: "x" }))).toBe("Missing token.");
  });

  it("should fallback to error.message for unknown codes", () => {
    const err = new AuthError({ code: "send_code_failed", message: "Custom send code error" });
    expect(toAuthErrorMessage(err)).toBe("Custom send code error");
  });

  it("should handle plain Error", () => {
    expect(toAuthErrorMessage(new Error("plain"))).toBe("plain");
  });

  it("should handle non-Error values", () => {
    expect(toAuthErrorMessage("string")).toBe("string");
    expect(toAuthErrorMessage(123)).toBe("123");
  });
});
