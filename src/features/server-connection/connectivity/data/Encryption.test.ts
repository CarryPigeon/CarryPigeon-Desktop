/**
 * @fileoverview Encryption 单元测试
 * @description 验证 AES-GCM 加解密、握手流程、帧配置、错误处理
 */

import { describe, expect, it } from "vitest";
import { Encryption } from "./Encryption";

describe("Encryption", () => {
  describe("constructor & configuration", () => {
    it("should create instance with server socket", () => {
      const enc = new Encryption("test-server");
      expect(enc.isHandshakeComplete()).toBe(false);
      expect(enc.getFrameConfig()).toEqual({
        lengthBytes: 2,
        byteOrder: "be",
        lengthIncludesHeader: false,
      });
    });

    it("should accept custom transport socket", () => {
      const enc = new Encryption("test-server", {
        transportSocket: "mock://local",
      });
      expect(enc.isHandshakeComplete()).toBe(false);
    });

    it("should accept custom frame config", () => {
      const enc = new Encryption("test-server", {
        frameConfig: { lengthBytes: 4, byteOrder: "be", lengthIncludesHeader: true },
      });
      const cfg = enc.getFrameConfig();
      expect(cfg.lengthBytes).toBe(4);
      expect(cfg.lengthIncludesHeader).toBe(true);
    });

    it("should set and get frame config", () => {
      const enc = new Encryption("test-server");
      enc.setFrameConfig({ lengthBytes: 4, byteOrder: "le", lengthIncludesHeader: false });
      const cfg = enc.getFrameConfig();
      expect(cfg.lengthBytes).toBe(4);
      expect(cfg.byteOrder).toBe("le");
    });
  });

  describe("mock handshake (swapKey)", () => {
    it("should complete mock handshake instantly", async () => {
      const enc = new Encryption("test-server", {
        transportSocket: "mock://local",
      });
      await enc.swapKey(1);
      expect(enc.isHandshakeComplete()).toBe(true);
    });

    it("should complete mock handshake when eccKey is 'mock'", async () => {
      const enc = new Encryption("test-server", {
        transportSocket: "tcp://real",
        serverEccPublicKeyBase64: "mock",
      });
      await enc.swapKey(1);
      expect(enc.isHandshakeComplete()).toBe(true);
    });
  });

  describe("encrypt / decrypt roundtrip (mock mode)", () => {
    it("should encrypt and decrypt successfully", async () => {
      const enc = new Encryption("test-server", { transportSocket: "mock://local" });
      await enc.swapKey(1);

      const plaintext = JSON.stringify({ route: "/chat/send", data: { text: "Hello" } });
      const encrypted = await enc.encrypt(plaintext);

      // Strip length-prefix bytes before decryption (2 bytes for default frame)
      const payload = encrypted.slice(2);
      const decrypted = await enc.decrypt(payload);
      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt different plaintexts to different ciphertexts", async () => {
      const enc = new Encryption("test-server", { transportSocket: "mock://local" });
      await enc.swapKey(1);

      const ct1 = await enc.encrypt("hello");
      const ct2 = await enc.encrypt("world");
      // Ciphertexts should differ (different nonces)
      const payload1 = ct1.slice(2);
      const payload2 = ct2.slice(2);
      expect(payload1).not.toEqual(payload2);
    });

    it("should increment send sequence after each encrypt", async () => {
      const enc = new Encryption("test-server", { transportSocket: "mock://local" });
      await enc.swapKey(1);

      await enc.encrypt("msg1");
      await enc.encrypt("msg2");
      const encrypted = await enc.encrypt("msg3");
      const payload = encrypted.slice(2);
      const decrypted = await enc.decrypt(payload);
      expect(decrypted).toBe("msg3");
    });
  });

  describe("encrypt without handshake", () => {
    it("should throw when AES key not initialized", async () => {
      const enc = new Encryption("test-server");
      await expect(enc.encrypt("test")).rejects.toThrow("AES key is not initialized");
    });
  });

  describe("decrypt error handling", () => {
    it("should throw on too-short payload", async () => {
      const enc = new Encryption("test-server", { transportSocket: "mock://local" });
      await enc.swapKey(1);

      await expect(enc.decrypt(new Uint8Array(10))).rejects.toThrow("Invalid encrypted payload length");
    });

    it("should throw on corrupted ciphertext", async () => {
      const enc = new Encryption("test-server", { transportSocket: "mock://local" });
      await enc.swapKey(1);

      // Create a payload with valid length but garbage content
      const badPayload = new Uint8Array(64);
      // Set non-zero nonce to bypass keepalive check
      badPayload[0] = 1;
      await expect(enc.decrypt(badPayload)).rejects.toThrow();
    });

    it("should return null for keepalive (all-zero nonce + empty cipher)", async () => {
      const enc = new Encryption("test-server", { transportSocket: "mock://local" });
      await enc.swapKey(1);

      // 12 zero nonce + 20 byte AAD (but ciphertext is empty = only 32 bytes total)
      // Actually the payload must be at least 32 bytes, and ciphertext is sliced from 32
      // If payload.length === 32, cipherText.length === 0, and nonce is checked for all zeros
      const keepalive = new Uint8Array(32); // all zeros = nonce(12) + aad(20) + empty cipher
      const result = await enc.decrypt(keepalive);
      expect(result).toBeNull();
    });
  });

  describe("tryHandleHandshakeResponse", () => {
    it("should return false for invalid data", () => {
      const enc = new Encryption("test-server");
      expect(enc.tryHandleHandshakeResponse(null)).toBe(false);
      expect(enc.tryHandleHandshakeResponse(undefined)).toBe(false);
      expect(enc.tryHandleHandshakeResponse("not an object")).toBe(false);
    });

    it("should return false for empty object", () => {
      const enc = new Encryption("test-server");
      expect(enc.tryHandleHandshakeResponse({})).toBe(false);
    });
  });

  describe("tryHandleHandshakeResponseText", () => {
    it("should return false for empty string", () => {
      const enc = new Encryption("test-server");
      expect(enc.tryHandleHandshakeResponseText("")).toBe(false);
    });

    it("should return false for invalid JSON", () => {
      const enc = new Encryption("test-server");
      expect(enc.tryHandleHandshakeResponseText("not json")).toBe(false);
    });
  });
});
