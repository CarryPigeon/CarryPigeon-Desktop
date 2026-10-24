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
    "当前使用服务端总结；如需改用自选模型，请到「设置 → 插件设置 → AI 摘要」配置自管 AI provider。",
  ai_summary_incomplete_config: "自管 AI 配置不完整（缺少 base URL 或模型名），请到「设置 → 插件设置 → AI 摘要」补全",
  ai_summary_api_key_missing: "已选择 {provider}，但尚未配置 API Key（设置 → 插件设置 → AI 摘要）",
  ai_summary_settings_title: "AI 摘要后端",
  ai_summary_settings_desc: "选择生成总结所走的通道；可在「设置 → 插件设置」中修改。",
  ai_summary_backend_auto: "自动",
  ai_summary_backend_client: "仅自配 AI",
  ai_summary_backend_server: "仅服务端",
  ai_summary_backend_hint_auto: "优先使用自配 AI（设置 → 插件设置 → AI 摘要）：未配置时自动回退聊天服务端。",
  ai_summary_backend_hint_client: "只使用自配 AI；未配置或调用失败时给出提示，不会偷偷回退服务端。",
  ai_summary_backend_hint_server: "只使用聊天服务端 /api/ai/summarize，忽略自配 AI。",
  ai_summary_backend_save_failed: "后端偏好保存失败，请稍后重试。",
  ai_summary_client_required_missing:
    "当前为「仅自配 AI」，但尚未配置 AI provider，请到「设置 → 插件设置 → AI 摘要」配置，或把后端改为「自动」/「仅服务端」",
  // 自管 provider 设置项（从宿主「AI 服务」设置迁移）
  ai_settings_title: "AI 服务提供方",
  ai_settings_desc: "配置本插件使用的 OpenAI 兼容 AI provider（base URL / 模型 / API Key / 采样参数）。",
  ai_settings_provider: "服务来源",
  ai_settings_base_url: "Base URL",
  ai_settings_model: "模型",
  ai_settings_model_placeholder: "先拉取模型列表，或手动填写模型名",
  ai_settings_model_pick: "从已拉取的模型中选择",
  ai_settings_model_pick_placeholder: "（不修改）",
  ai_settings_fetch_models: "拉取模型列表",
  ai_settings_fetching: "拉取中…",
  ai_settings_models_failed: "拉取模型列表失败。",
  ai_settings_models_loaded: "已拉取 {count} 个模型。",
  ai_settings_api_key: "API Key",
  ai_settings_api_key_placeholder: "sk-…（仅写入系统凭据管理器）",
  ai_settings_api_key_saved: "已配置",
  ai_settings_api_key_not_set: "未配置",
  ai_settings_save_key: "保存密钥",
  ai_settings_clear_key: "清除密钥",
  ai_settings_key_saved_toast: "API Key 已保存到系统凭据管理器。",
  ai_settings_key_cleared_toast: "API Key 已清除。",
  ai_settings_key_save_failed: "保存 API Key 失败。",
  ai_settings_key_clear_failed: "清除 API Key 失败。",
  ai_settings_enter_key: "请输入 API Key。",
  ai_settings_base_url_required: "请先填写 Base URL。",
  ai_settings_secret_hint: "API Key 仅写入系统凭据管理器，不落插件存储与日志。",
  ai_settings_secure_storage_unavailable: "系统凭据管理器不可用，无法保存 API Key。",
  ai_settings_advanced: "高级（采样参数与提示词）",
  ai_settings_temperature: "温度",
  ai_settings_timeout: "超时（毫秒）",
  ai_settings_system_prompt: "系统提示词",
  ai_settings_system_prompt_placeholder: "留空使用内置默认提示词",
  ai_settings_status_ready: "自配 AI 已就绪",
  ai_settings_status_not_ready: "自配 AI 未配置",
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
    "Using the server-side summary. To use your own model, configure the plugin AI provider in Settings → Plugin settings → AI summary.",
  ai_summary_incomplete_config:
    "The plugin AI configuration is incomplete (missing base URL or model). Finish it in Settings → Plugin settings → AI summary.",
  ai_summary_api_key_missing: "{provider} is selected but no API key is configured (Settings → Plugin settings → AI summary)",
  ai_summary_settings_title: "AI summary backend",
  ai_summary_settings_desc: "Pick the channel used to generate summaries; editable in Settings → Plugin settings.",
  ai_summary_backend_auto: "Auto",
  ai_summary_backend_client: "Own AI only",
  ai_summary_backend_server: "Server only",
  ai_summary_backend_hint_auto: "Prefer the plugin-configured AI (Settings → Plugin settings → AI summary); fall back to the chat server when it is not configured.",
  ai_summary_backend_hint_client: "Use the plugin-configured AI only; when it is not configured or fails, show a hint instead of silently falling back.",
  ai_summary_backend_hint_server: "Use the chat server /api/ai/summarize only; ignore the plugin AI configuration.",
  ai_summary_backend_save_failed: "Failed to save the backend preference. Try again later.",
  ai_summary_client_required_missing:
    "Backend is “Own AI only” but no AI provider is configured. Configure it in Settings → Plugin settings → AI summary, or switch the backend to “Auto” / “Server only”.",
  // Plugin-managed provider settings (migrated from the host Settings → AI service tab)
  ai_settings_title: "AI service provider",
  ai_settings_desc: "Configure the OpenAI-compatible AI provider used by this plugin (base URL / model / API key / sampling).",
  ai_settings_provider: "Provider",
  ai_settings_base_url: "Base URL",
  ai_settings_model: "Model",
  ai_settings_model_placeholder: "Fetch the model list first, or type a model name",
  ai_settings_model_pick: "Pick from fetched models",
  ai_settings_model_pick_placeholder: "(leave unchanged)",
  ai_settings_fetch_models: "Fetch models",
  ai_settings_fetching: "Fetching…",
  ai_settings_models_failed: "Failed to fetch the model list.",
  ai_settings_models_loaded: "Fetched {count} model(s).",
  ai_settings_api_key: "API Key",
  ai_settings_api_key_placeholder: "sk-… (stored in the OS credential store only)",
  ai_settings_api_key_saved: "configured",
  ai_settings_api_key_not_set: "not configured",
  ai_settings_save_key: "Save key",
  ai_settings_clear_key: "Clear key",
  ai_settings_key_saved_toast: "API key saved to the OS credential store.",
  ai_settings_key_cleared_toast: "API key cleared.",
  ai_settings_key_save_failed: "Failed to save the API key.",
  ai_settings_key_clear_failed: "Failed to clear the API key.",
  ai_settings_enter_key: "Enter an API key first.",
  ai_settings_base_url_required: "Fill in the base URL first.",
  ai_settings_secret_hint: "The API key goes to the OS credential store only, never to plugin storage or logs.",
  ai_settings_secure_storage_unavailable:
    "The OS credential store is unavailable, so the API key cannot be saved.",
  ai_settings_advanced: "Advanced (sampling and prompt)",
  ai_settings_temperature: "Temperature",
  ai_settings_timeout: "Timeout (ms)",
  ai_settings_system_prompt: "System prompt",
  ai_settings_system_prompt_placeholder: "Leave empty to use the built-in default prompt",
  ai_settings_status_ready: "Own AI ready",
  ai_settings_status_not_ready: "Own AI not configured",
};

const messages: Record<string, Dict> = { zh_cn: zhCn, en };

/**
 * 轻量 i18n 读取：根据已绑定宿主上下文的 lang 取对应字典。
 * 支持 {name} 形式的具名插值。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let lang = "zh_cn";
  try {
    lang = getContext().server.lang || "zh_cn";
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
