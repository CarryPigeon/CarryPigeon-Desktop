// 插件自带文案：简单双语（zh_cn 默认 / en），不依赖宿主 i18n 文件。
import { getContext } from "../host/bridge";

type Dict = Record<string, string>;

const zhCn: Dict = {
  ai_summary_panel_title: "AI 总结",
  ai_summary_run: "生成总结",
  ai_summary_close: "关闭",
  ai_summary_messages_label: "待总结消息（每行一条）",
  ai_summary_messages_placeholder: "每行输入一条消息…",
  ai_summary_result_title: "总结结果",
  ai_summary_cached: "（缓存）",
  ai_summary_empty_messages: "请至少输入一条消息",
  ai_summary_no_channel: "请先选择一个频道，再生成总结",
  ai_summary_failed: "总结请求失败",
  ai_summary_message_count: "共 {count} 条消息",
  ai_summary_source_client: "来源：{provider} · {model}",
  ai_summary_source_server: "来源：聊天服务端 /api/ai/summarize",
  ai_summary_configure_hint:
    "当前使用服务端总结；如需改用自选模型，请到「设置 → AI 服务」配置客户端 AI provider。",
  ai_summary_incomplete_config: "客户端 AI 配置不完整（缺少 base URL 或模型名），请到「设置 → AI 服务」补全",
  ai_summary_api_key_missing: "已选择 {provider}，但尚未配置 API Key（设置 → AI 服务）",
};

const en: Dict = {
  ai_summary_panel_title: "AI Summary",
  ai_summary_run: "Summarize",
  ai_summary_close: "Close",
  ai_summary_messages_label: "Messages to summarize (one per line)",
  ai_summary_messages_placeholder: "One message per line…",
  ai_summary_result_title: "Summary",
  ai_summary_cached: "(cached)",
  ai_summary_empty_messages: "Please enter at least one message",
  ai_summary_no_channel: "Select a channel before summarizing",
  ai_summary_failed: "Summarize request failed",
  ai_summary_message_count: "{count} message(s)",
  ai_summary_source_client: "Source: {provider} · {model}",
  ai_summary_source_server: "Source: chat server /api/ai/summarize",
  ai_summary_configure_hint:
    "Using the server-side summary. To use your own model, configure a client AI provider in Settings → AI service.",
  ai_summary_incomplete_config:
    "Client AI is incomplete (missing base URL or model). Finish it in Settings → AI service.",
  ai_summary_api_key_missing: "{provider} is selected but no API key is configured (Settings → AI service)",
};

const messages: Record<string, Dict> = { zh_cn: zhCn, en };

/**
 * 轻量 i18n 读取：根据已绑定宿主上下文的 lang 取对应字典。
 * 支持 {name} 形式的具名插值。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let lang = "zh_cn";
  try {
    lang = getContext().lang || "zh_cn";
  } catch {
    // 插件上下文尚未绑定（如非运行时场景），回退默认语言。
  }
  const dict = messages[lang] ?? zhCn;
  let str = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
