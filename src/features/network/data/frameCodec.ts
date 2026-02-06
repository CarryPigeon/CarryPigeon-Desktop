/**
 * @fileoverview frameCodec.ts
 * @description network｜数据层工具：Netty length-prefix 帧封装（与 Rust 侧拆包对齐）。
 *
 * 背景：
 * - Rust/Netty 侧通常使用“长度前缀”做拆包（length-based decoder）。
 * - 前端只负责对“单条 payload”做封帧（frame），拆包（deframe）由 Rust 侧完成。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不输出日志）。
 */

/**
 * 帧头字段的字节序。
 *
 * 说明：
 * - `"be"`：大端（big-endian）。
 * - `"le"`：小端（little-endian）。
 */
export type FrameByteOrder = "be" | "le";

/**
 * 帧头长度字段占用的字节数。
 *
 * 说明：
 * - `2`：使用 u16 表示 payload 长度。
 * - `4`：使用 u32 表示 payload 长度。
 */
export type FrameLengthBytes = 2 | 4;

/**
 * length-prefix 帧配置。
 */
export type FrameConfig = {
  /**
   * 长度字段占用字节数（u16/u32）。
   */
  lengthBytes: FrameLengthBytes;
  /**
   * 长度字段字节序。
   */
  byteOrder: FrameByteOrder;
  /**
   * length 是否包含 header 本身（不同实现可能不同）。
   */
  lengthIncludesHeader: boolean;
};

/**
 * 对 payload 进行 Netty 风格 length-prefix 封帧。
 *
 * @param payload - 原始 payload 字节。
 * @param config - 帧配置（u16/u32、字节序、length 是否包含 header）。
 * @returns 新的 Uint8Array：`[len][payload]`。
 */
export function frameNettyPayload(payload: Uint8Array, config: FrameConfig): Uint8Array {
  const headerBytes = config.lengthBytes;
  const totalLength = payload.length + (config.lengthIncludesHeader ? headerBytes : 0);

  if (headerBytes === 2) {
    if (totalLength > 0xffff) throw new Error(`Netty payload too large for u16 length: ${totalLength}`);
    const out = new Uint8Array(headerBytes + payload.length);
    new DataView(out.buffer).setUint16(0, totalLength, config.byteOrder === "le");
    out.set(payload, headerBytes);
    return out;
  }

  const out = new Uint8Array(headerBytes + payload.length);
  new DataView(out.buffer).setUint32(0, totalLength >>> 0, config.byteOrder === "le");
  out.set(payload, headerBytes);
  return out;
}
