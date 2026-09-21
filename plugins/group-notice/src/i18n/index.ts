// 插件自带文案：简单双语（zh_cn 默认 / en），不依赖宿主 i18n 文件。
import { getContext } from "../host/bridge";

type Dict = Record<string, string>;

const zhCn: Dict = {
  group_notice_panel_title: "群通知",
  group_notice_refresh: "刷新",
  group_notice_mark_all_read: "全部已读",
  group_notice_close: "关闭",
  group_notice_unread: "未读",
  group_notice_read: "已读",
  group_notice_empty: "暂无通知",
  group_notice_load_failed: "通知加载失败",
  group_notice_loading: "加载中…",
};

const en: Dict = {
  group_notice_panel_title: "Group Notices",
  group_notice_refresh: "Refresh",
  group_notice_mark_all_read: "Mark all read",
  group_notice_close: "Close",
  group_notice_unread: "Unread",
  group_notice_read: "Read",
  group_notice_empty: "No notices yet",
  group_notice_load_failed: "Failed to load notices",
  group_notice_loading: "Loading…",
};

const messages: Record<string, Dict> = { zh_cn: zhCn, en };

/**
 * 轻量 i18n 读取：根据已绑定宿主上下文的 lang 取对应字典。
 */
export function t(key: string): string {
  let lang = "zh_cn";
  try {
    lang = getContext().lang || "zh_cn";
  } catch {
    // 插件上下文尚未绑定（如非运行时场景），回退默认语言。
  }
  const dict = messages[lang] ?? zhCn;
  return dict[key] ?? key;
}
