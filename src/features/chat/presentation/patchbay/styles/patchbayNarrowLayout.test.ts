/**
 * @fileoverview patchbayNarrowLayout.test.ts
 * @description 样式契约：窄宽度自适应（面板被压窄）依赖的关键声明不得被无声改坏。
 *
 * 说明：jsdom 无布局引擎，无法断言真实渲染结果，因此本文件以「样式源码中的声明」为契约，
 * 经 Vite 的 `?raw` 导入读取源码文本。断言用宽松正则，容忍空白与格式差异；只钉住两类
 * 曾导致真实缺陷的声明：
 * 1) flex 子项缺 `min-width: 0` → `text-overflow: ellipsis` 永不生效、卡片撑破消息行；
 * 2) 消息区双向滚动 → 面板压窄时冒出底部横向滚动条。
 */

import { describe, expect, it } from "vitest";
import patchbayScss from "./patchbay.scss?raw";
import coreTextBubbleSource from "../../../message-flow/message/presentation/components/CoreTextMessageBubble.vue?raw";
import messageContentHostSource from "../../../message-flow/message/presentation/components/MessageContentHost.vue?raw";

/** 转义正则元字符，便于用字面量拼接选择器/声明。 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 取某选择器的全部规则块声明体。
 *
 * @param source - 样式源码。
 * @param selector - 选择器字面量（如 `.cp-msg`）。
 * @returns 每个匹配规则块的声明体；无匹配返回空数组。
 */
function ruleBodies(source: string, selector: string): string[] {
  const re = new RegExp(`(?:^|[\\s,])${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, "g");
  const bodies: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) bodies.push(match[1] ?? "");
  return bodies;
}

/**
 * 判断声明体中是否含指定声明。
 *
 * @param body - 规则块声明体。
 * @param declaration - 声明前缀（如 `min-width: 0`）。
 * @returns 含该声明返回 `true`。
 */
function declares(body: string, declaration: string): boolean {
  return new RegExp(`${escapeRegExp(declaration)}\\s*;`).test(body);
}

/**
 * 按花括号配对取出一个 `@container` 区块（含嵌套规则）。
 *
 * @param source - 样式源码。
 * @param maxWidth - 断点宽度（px）。
 * @returns 区块源码；未找到返回空串。
 */
function containerBlock(source: string, maxWidth: number): string {
  const start = source.indexOf(`@container (max-width: ${maxWidth}px)`);
  if (start === -1) return "";
  const open = source.indexOf("{", start);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return "";
}

describe("patchbay 窄宽度自适应样式契约", () => {
  it("消息区只纵向滚动，不出现横向滚动条", () => {
    const bodies = ruleBodies(patchbayScss, ".cp-signalPane");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((body) => declares(body, "overflow-x: hidden"))).toBe(true);
    expect(bodies.some((body) => declares(body, "overflow-y: auto"))).toBe(true);
  });

  it("中间栏建立容器查询上下文，供窄宽度断点使用", () => {
    const bodies = ruleBodies(patchbayScss, ".cp-center");
    expect(bodies.some((body) => declares(body, "container-type: inline-size"))).toBe(true);
  });

  it("窄宽度断点存在两级，且首级收紧了头像列宽", () => {
    const narrow = containerBlock(patchbayScss, 520);
    const narrower = containerBlock(patchbayScss, 400);
    expect(narrow).not.toBe("");
    expect(narrower).not.toBe("");

    const msgBodies = ruleBodies(narrow, ".cp-msg");
    expect(msgBodies.some((body) => declares(body, "grid-template-columns: 40px 2px 1fr"))).toBe(
      true,
    );
    // mine 行必须镜像同一列宽，否则自己发的消息与对方消息密度不一致
    const mineBodies = ruleBodies(narrow, '.cp-msg[data-mine="true"]');
    expect(mineBodies.some((body) => declares(body, "grid-template-columns: 1fr 2px 40px"))).toBe(
      true,
    );
  });

  it("二级断点同步缩小名称与时间，避免时间大于名字", () => {
    const narrower = containerBlock(patchbayScss, 400);
    // 二者必须写在同一组选择器里：.cp-msg__time 自带 font-size: 12px，
    // 只改 .cp-msg__meta 会让时间比名字还大（层级倒挂）。
    expect(/\.cp-msg__from\s*,\s*\.cp-msg__time\s*\{\s*font-size:\s*11px\s*;/.test(narrower)).toBe(
      true,
    );
  });

  it("引用预览的 flex 子项显式归零 min-width，省略号才会生效", () => {
    const bodies = ruleBodies(coreTextBubbleSource, ".cp-quoteReply__preview");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((body) => declares(body, "min-width: 0"))).toBe(true);
    expect(bodies.some((body) => declares(body, "white-space: nowrap"))).toBe(true);
  });

  it("消息内容包装容器不超过内容槽位宽度", () => {
    const bodies = ruleBodies(messageContentHostSource, ".cp-messageContent");
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.some((body) => declares(body, "max-width: 100%"))).toBe(true);
    expect(bodies.some((body) => declares(body, "min-width: 0"))).toBe(true);
  });
});
