/**
 * @fileoverview plugins｜领域类型：pluginRuntimeTypes。
 * @description
 * 插件运行时与宿主交互的“契约类型”（不包含实现细节）。
 *
 * 说明：
 * - 这些类型用于让 chat（宿主）与 plugins（运行时加载器）在类型层面对齐；
 * - 该文件不依赖 Vue/Tauri 等平台库，便于跨层复用与测试。
 */

import type { Component, ComponentPublicInstance } from "vue";

/**
 * 插件在 chat 工具栏点击时接收到的实时聊天上下文。
 *
 * 说明：
 * - `channelId` 即当前频道 id（用于语音/视频通话的 roomId）；
 * - `targetUserId` 为一对一通话对象（群聊/会议场景通常为空）；
 * - 该上下文由宿主在调用 `ToolbarAction.onClick` 时实时注入，插件无需自行维护。
 */
export type PluginChatContext = {
  channelId: string;
  channelName?: string;
  targetUserId?: string;
};

/**
 * `host.mountOverlay` 的返回值句柄。
 *
 * 说明：
 * - `unmount` 用于卸载浮层；
 * - `instance` 为挂载浮层组件的公开实例（含插件 `defineExpose` 暴露的方法），
 *   组件尚未完成挂载时为 `null`，调用方应在点击等异步时机读取。
 */
export type PluginOverlayMountHandle = {
  unmount: () => void;
  instance: ComponentPublicInstance | null;
};

/**
 * 插件编辑器（composer）提交给宿主的载荷格式。
 *
 * 说明：
 * - `domain/domainVersion` 用于让宿主路由到正确的消息通道/协议处理；
 * - `data` 由具体 domain contract 定义（宿主仅透传，不做强校验）；
 * - `replyToMessageId` 用于回复链路（可选）。
 */
export type PluginComposerPayload = {
  domain: string;
  domainVersion: string;
  data: unknown;
  replyToMessageId?: string;
};

/**
 * `host.secrets` 的密钥状态（不含密钥内容）。
 */
export type PluginSecretStatus = {
  /** 是否已配置密钥。 */
  configured: boolean;
  /** 系统安全存储（keyring）是否可用；不可用时写入会失败。 */
  secureStorageAvailable: boolean;
};

/**
 * `host.secrets` 能力面（"secrets" 权限门控）。
 *
 * 安全约束：
 * - 密钥写入系统凭据管理器（按 serverId + pluginId + name 三段隔离），
 *   插件无法回读明文，密钥也不落插件 KV 存储（storage）；
 * - `status` 只返回"是否已配置 + 存储是否可用"，用于 UI 提示与请求前预检；
 * - 网络请求头值中的 `@secret(<name>)` 引用由宿主在 Rust 侧解析替换，
 *   密钥明文不进入 WebView。
 */
export type PluginSecretsApi = {
  /** 写入（覆盖）密钥（只写不读）。 */
  set(name: string, value: string): Promise<void>;
  /** 查询密钥状态（不返回密钥内容）。 */
  status(name: string): Promise<PluginSecretStatus>;
  /** 清除密钥（幂等）。 */
  clear(name: string): Promise<void>;
};

/**
 * 读取到的单条频道消息（只读投影，不携带原始 wire 字段）。
 */
export type PluginChannelMessage = {
  /** 消息 id。 */
  messageId: string;
  /** 发送者 id。 */
  senderId: string;
  /** 发送者展示名；宿主无法解析时回退为 senderId。 */
  senderName: string;
  /** 发送时间（ms）。 */
  timeMs: number;
  /** 可读文本投影：文本消息为正文，图片/视频/插件域消息为 preview 或占位描述。 */
  text: string;
};

/**
 * `host.messages.readCurrentChannel` 的返回快照。
 *
 * 说明：
 * - 只覆盖“当前频道”已载入的时间线，宿主不会为了该读取发起历史翻页；
 * - 已撤回消息与文本投影为空的条目已被宿主过滤，`totalCount` 为过滤前条数；
 * - `selectedMessageIds` 复用聊天视图的多选状态（右键消息 →「多选」），
 *   与 `messages` 同权限、同频道，不新增可读范围。
 */
export type PluginCurrentChannelMessagesSnapshot = {
  /** 当前频道 id；空字符串表示宿主当前未选择频道。 */
  channelId: string;
  /** 频道展示名；无法解析时回退为 channelId。 */
  channelName: string;
  /** 时间线中该频道的消息总数（裁剪前，含被过滤掉的条目）。 */
  totalCount: number;
  /** 是否因单次上限（500 条）被裁剪。 */
  truncated: boolean;
  /** 时间线是否仍有更早历史未载入。 */
  hasMoreHistory: boolean;
  /** 读取时刻（ms）。 */
  capturedAtMs: number;
  /** 按时间升序（旧 → 新）的消息列表。 */
  messages: PluginChannelMessage[];
  /**
   * 聊天视图中当前多选中、且本次快照里可参与总结的消息 id（时间线顺序）。
   *
   * 说明：
   * - 只包含“已载入且通过投影过滤”（未撤回、文本投影非空）的选中项；
   * - 未处于多选、或旧客户端未提供该字段时为空数组；
   * - 插件应把它当作“用户显式圈定的范围”，不应默认发送整个 `messages`。
   */
  selectedMessageIds: string[];
  /**
   * 聊天视图中当前多选的原始条数（含被投影过滤或未载入的条目）。
   *
   * 用途：与 `selectedMessageIds.length` 比较后提示“部分选中项不可参与总结”，
   * 避免插件静默丢弃用户的选择。
   */
  selectedTotalCount: number;
};

/**
 * `host.messages.loadMoreHistory` 的结果。
 */
export type PluginChannelHistoryLoadResult = {
  /** 调用后时间线中的消息总数。 */
  loadedCount: number;
  /** 本次新增载入条数（0 表示已无更早历史、有并发翻页或本次加载失败）。 */
  loadedDelta: number;
  /** 是否仍有更早历史未载入。 */
  hasMore: boolean;
};

/**
 * `host.messages` 能力面（"messages:read" 权限门控）。
 *
 * 安全约束：
 * - 只暴露“当前频道”的读取，不接受任意 channelId，插件无法读取用户未打开的频道；
 * - `readCurrentChannel` 为只读快照，不改动聊天视图，也不触发网络请求；
 *   快照会附带聊天视图“当前多选中”的消息 id（见 `selectedMessageIds`），
 *   供插件让用户显式圈定范围，不构成新的读取权限；
 * - `loadMoreHistory` 会向聊天视图补入更早消息并访问当前 server origin，
 *   插件只应在用户显式动作（点击按钮）时调用；
 * - 单次最多返回 500 条（与宿主 AI 总结上限一致），插件无法请求更大范围。
 */
export type PluginMessagesApi = {
  /**
   * 读取当前频道已载入的消息。
   *
   * @param input - 可选的单次上限（越界时由宿主钳制到 [1, 500]，缺省 500）。
   * @returns 当前频道消息快照；宿主未选择频道时 `channelId` 为空字符串。
   */
  readCurrentChannel(input?: { maxMessages?: number }): Promise<PluginCurrentChannelMessagesSnapshot>;
  /**
   * 向更早历史翻页一页，并回报调用前后的条数变化。
   *
   * @returns 翻页结果；无频道/无更多历史/并发翻页时 `loadedDelta` 为 0。
   */
  loadMoreHistory(): Promise<PluginChannelHistoryLoadResult>;
};

/**
 * 插件运行时对外声明的 domain contract。
 */
export type PluginRuntimeContract = {
  domain: string;
  domainVersion: string;
  payloadSchema?: unknown;
  constraints?: unknown;
};

/**
 * 插件注册设置项的输入（宿主会额外注入 `pluginId` / `serverSocket`，插件无法伪造来源）。
 *
 * 说明：
 * - `id` 在插件内唯一，规范化后须匹配 {@link PLUGIN_SETTINGS_ITEM_ID_PATTERN}；
 * - `title` / `description` 由**插件自行本地化**（例如读取 `ctx.server.lang`），宿主不做翻译，
 *   仅把声明文本用于设置页展示与搜索；
 * - `component` 只负责控件本身（宿主提供卡片外壳、分组与错误边界）；
 * - 注册随插件 fiber 自动反注册（`ctx.effect`），无需插件手动清理。
 */
export type PluginSettingsItemInput = {
  /** 插件内唯一的设置项 id（锚点稳定标识，重复注册视为替换）。 */
  id: string;
  /** 设置项标题（必填，非空）。 */
  title: string;
  /** 补充说明（可选，参与搜索）。 */
  description?: string;
  /** 追加搜索关键词（可选；建议同时给出中英文同义词）。 */
  keywords?: readonly string[];
  /** 展示顺序，越小越靠前；缺省按 0 处理。 */
  order?: number;
  /** 设置项控件组件。 */
  component: Component;
};

/**
 * 插件设置项注册表中的记录（宿主注入来源信息）。
 */
export type PluginSettingsContribution = Omit<PluginSettingsItemInput, "keywords" | "order"> & {
  /** 规范化后的关键词（trim + 去空 + 去重）。 */
  readonly keywords: readonly string[];
  /** 规范化后的排序值（非有限数按 0 处理）。 */
  readonly order: number;
  /** 注册该设置项的插件 id（宿主注入）。 */
  readonly pluginId: string;
  /** 归一化 server key（`normalizeServerKey`，宿主注入）。 */
  readonly serverSocket: string;
};

/**
 * 设置项 id 白名单：仅允许字母/数字与 `._:-`，长度 1–64。
 *
 * 目的：id 会作为 DOM 锚点值（`data-settings-item`）使用，限制字符集可避免选择器转义问题。
 */
export const PLUGIN_SETTINGS_ITEM_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * 注入给插件的运行时上下文（Host API）。
 *
 * 说明：
 * - 该类型描述“宿主允许插件做什么”，是插件权限与能力边界的核心；
 * - 其中 `host.network` / `host.secrets` 为可选：只有在插件声明并通过宿主校验后才会注入。
 */
export type PluginContext = {
  serverSocket: string;
  serverId: string;
  pluginId: string;
  pluginVersion: string;
  cid: string;
  uid: string;
  lang: string;
  /** 注册插件级清理回调（scope dispose 时触发，用于自动释放插件持有的资源） */
  onDispose?: (cb: () => void) => void;
  host: {
    sendMessage(payload: PluginComposerPayload): Promise<void>;
    storage: {
      get(key: string): Promise<unknown>;
      set(key: string, value: unknown): Promise<void>;
    };
    network?: {
      fetch(
        input: string,
        init?: {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          timeoutMs?: number;
        },
      ): Promise<{
        ok: boolean;
        status: number;
        headers: Record<string, string>;
        bodyText: string;
      }>;
    };
    /** 泛型命令调用（权限 + 命令白名单，建议前缀 voice_call:*） */
    invoke?: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
    /** 订阅宿主 Tauri 事件（权限 + 事件白名单），返回取消函数 */
    onEvent?: <T = unknown>(event: string, handler: (payload: T) => void) => () => void;
    /**
     * 插件密钥保管箱能力（"secrets" 权限门控）。
     *
     * 说明：密钥存系统 keyring（按 server + plugin 隔离），只写不读；
     * 网络请求头中的 `@secret(<name>)` 引用由宿主解析替换。
     */
    secrets?: PluginSecretsApi;
    /**
     * 当前频道消息读取能力（"messages:read" 权限门控）。
     *
     * 说明：只读当前频道，不提供任意频道读取；未声明该权限时不会注入。
     */
    messages?: PluginMessagesApi;
    /** 挂载全局浮层组件，返回卸载函数与组件实例句柄 */
    mountOverlay?: (component: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }) => PluginOverlayMountHandle;
    /** 注册聊天头部/工具栏入口，返回注销函数 */
    registerToolbarAction?: (action: {
      id: string;
      label: string;
      icon?: Component;
      order?: number;
      onClick: (ctx: PluginChatContext) => void;
    }) => () => void;
  };
};
