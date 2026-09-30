// 插件自带文案：简单双语（zh_cn 默认 / en），不依赖宿主 i18n 文件。
import { getContext } from "../host/bridge";

type Dict = Record<string, string>;

const zhCn: Dict = {
  ai_summary_panel_title: "AI 总结",
  ai_summary_run: "生成总结",
  ai_summary_regenerate: "重新生成",
  ai_summary_close: "关闭",
  ai_summary_reading: "正在读取当前频道…",
  ai_summary_message_count: "共 {count} 条消息",
  ai_summary_loaded_count: "频道已载入 {loaded} 条",
  ai_summary_time_range: "时间范围：{range}",
  ai_summary_scope_label: "范围",
  ai_summary_scope_all: "全部（{count} 条）",
  ai_summary_scope_selection: "聊天中已选（{count} 条）",
  ai_summary_scope_selection_hint: "在聊天中右键消息 →「多选」可勾选要总结的消息",
  ai_summary_scope_selection_partial: "聊天中已选 {total} 条，其中 {usable} 条可参与总结",
  ai_summary_scope_empty: "当前范围内没有可总结的消息，请调整时间范围或重新多选消息",
  ai_summary_range_label: "时间",
  ai_summary_range_none: "不限",
  ai_summary_range_hour: "最近 1 小时",
  ai_summary_range_today: "今天",
  ai_summary_range_week: "最近 7 天",
  ai_summary_range_placeholder: "选择时间",
  ai_summary_truncated: "消息较多，仅包含最近 {count} 条",
  ai_summary_more_history: "频道还有更早的历史消息未载入",
  ai_summary_load_more: "加载更多历史",
  ai_summary_load_more_done: "已载入 {count} 条更早消息",
  ai_summary_load_more_none: "已无更早历史",
  ai_summary_load_more_failed: "加载更早消息失败，请稍后重试",
  ai_summary_result_title: "总结结果",
  ai_summary_cached: "（缓存）",
  ai_summary_empty_messages: "当前频道暂无可总结的消息",
  ai_summary_no_channel: "请先选择一个频道，再生成总结",
  ai_summary_unsupported_host: "当前客户端版本不支持读取频道消息，请升级客户端后重试",
  ai_summary_failed: "总结请求失败",
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
  ai_summary_regenerate: "Regenerate",
  ai_summary_close: "Close",
  ai_summary_reading: "Reading the current channel…",
  ai_summary_message_count: "{count} message(s)",
  ai_summary_loaded_count: "{loaded} message(s) loaded in the channel",
  ai_summary_time_range: "Time range: {range}",
  ai_summary_scope_label: "Scope",
  ai_summary_scope_all: "All ({count})",
  ai_summary_scope_selection: "Selected in chat ({count})",
  ai_summary_scope_selection_hint:
    "Right-click a message in the chat → “Multi-select” to pick the messages to summarize",
  ai_summary_scope_selection_partial:
    "{total} message(s) selected in chat, {usable} of them can be summarized",
  ai_summary_scope_empty: "No summarizable message in the current scope. Adjust the time range or re-select.",
  ai_summary_range_label: "Time",
  ai_summary_range_none: "Any",
  ai_summary_range_hour: "Last hour",
  ai_summary_range_today: "Today",
  ai_summary_range_week: "Last 7 days",
  ai_summary_range_placeholder: "Pick time",
  ai_summary_truncated: "Too many messages; only the latest {count} are included",
  ai_summary_more_history: "Earlier history is not loaded yet",
  ai_summary_load_more: "Load earlier messages",
  ai_summary_load_more_done: "Loaded {count} earlier message(s)",
  ai_summary_load_more_none: "No earlier history",
  ai_summary_load_more_failed: "Failed to load earlier messages. Try again later.",
  ai_summary_result_title: "Summary",
  ai_summary_cached: "(cached)",
  ai_summary_empty_messages: "No messages to summarize in this channel",
  ai_summary_no_channel: "Select a channel before summarizing",
  ai_summary_unsupported_host:
    "This client version cannot read channel messages. Please update the client.",
  ai_summary_failed: "Summarize request failed",
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
