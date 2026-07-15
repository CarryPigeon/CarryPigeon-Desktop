import { voiceCallMessages } from "./messages";
import { getContext } from "../host/bridge";

type Dict = Record<string, string>;

/**
 * 轻量 i18n 读取：根据已绑定宿主上下文的 lang 取对应字典。
 * 支持 {name} 形式的具名插值（与 vue-i18n 调用方式保持一致）。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let lang = "zh_cn";
  try {
    lang = getContext().lang || "zh_cn";
  } catch {
    // 插件上下文尚未绑定（如非运行时场景），回退默认语言。
  }
  const messages = voiceCallMessages as Record<string, Dict>;
  const dict = messages[lang] ?? messages.zh_cn;
  let str = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
