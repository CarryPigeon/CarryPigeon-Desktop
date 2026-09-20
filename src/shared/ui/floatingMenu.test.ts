/**
 * @fileoverview floatingMenu 单元测试｜视口钳制与翻转逻辑。
 * @description shared/ui：验证 clampMenuPosition 在各窗口边界场景下的行为。
 */

import { describe, expect, it } from "vitest";
import { clampMenuPosition } from "./floatingMenu";

describe("clampMenuPosition", () => {
  it("空间充足时按期望坐标原样放置", () => {
    const r = clampMenuPosition(200, 200, 180, 240, 1024, 768);
    expect(r.left).toBe(200);
    expect(r.top).toBe(200);
    expect(r.flippedUp).toBe(false);
    expect(r.flippedLeft).toBe(false);
  });

  it("右侧空间不足时向左翻转", () => {
    // 期望 x=900，菜单宽 180，视口宽 1024 → 900+180 > 1024-8，翻转到 720
    const r = clampMenuPosition(900, 100, 180, 100, 1024, 768);
    expect(r.left).toBe(900 - 180);
    expect(r.flippedLeft).toBe(true);
  });

  it("下方空间不足时向上翻转", () => {
    // 期望 y=700，菜单高 240，视口高 768 → 700+240 > 768-8，翻转到 460
    const r = clampMenuPosition(100, 700, 180, 240, 1024, 768);
    expect(r.top).toBe(700 - 240);
    expect(r.flippedUp).toBe(true);
  });

  it("右下角同时不足时双向翻转", () => {
    const r = clampMenuPosition(1000, 740, 180, 240, 1024, 768);
    expect(r.left).toBe(1000 - 180);
    expect(r.top).toBe(740 - 240);
    expect(r.flippedLeft).toBe(true);
    expect(r.flippedUp).toBe(true);
  });

  it("期望坐标越界且翻转也放不下时贴边钳制", () => {
    // 期望 x=-50（越界），翻转后 -230 也越界 → 钳制到 margin
    const r = clampMenuPosition(-50, 100, 180, 100, 1024, 768);
    expect(r.left).toBe(8);
  });

  it("菜单尺寸超过视口时给出全视口 max 尺寸并贴边", () => {
    const r = clampMenuPosition(500, 500, 1200, 900, 800, 600, 8);
    // 两端都放不下：钳制到 margin 起点
    expect(r.left).toBe(8);
    expect(r.top).toBe(8);
    // max 约束保证菜单内部滚动可达全部内容
    expect(r.maxHeight).toBe(600 - 16);
    expect(r.maxWidth).toBe(800 - 16);
  });

  it("自定义 margin 生效", () => {
    const r = clampMenuPosition(-10, -10, 100, 100, 400, 300, 20);
    expect(r.left).toBe(20);
    expect(r.top).toBe(20);
    expect(r.maxHeight).toBe(300 - 40);
  });
});
