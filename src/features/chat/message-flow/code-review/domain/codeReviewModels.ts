/**
 * @fileoverview code-review｜domain｜代码审查注释模型。
 * @description
 * 聊天内代码片段审查的本地注释模型。v0.4.0 采用本地存储，不进入服务端协议。
 */

export type CodeReviewComment = {
  /** 注释唯一 id。 */
  commentId: string;
  /** 被评论的消息 id。 */
  messageId: string;
  /** 代码块在消息中的索引（从 0 开始）。 */
  codeBlockIndex: number;
  /** 被评论的行号（从 1 开始）。 */
  lineNumber: number;
  /** 评论作者用户 id。 */
  authorId: string;
  /** 评论作者显示名。 */
  authorName: string;
  /** 评论内容。 */
  text: string;
  /** 创建时间戳（ms）。 */
  createdAt: number;
};

export type CodeBlockInfo = {
  /** 代码语言标识（可能为空）。 */
  language: string;
  /** 代码内容。 */
  code: string;
  /** 代码行数组。 */
  lines: string[];
};

export type CodeReviewCommentsByLine = Map<number, CodeReviewComment[]>;
