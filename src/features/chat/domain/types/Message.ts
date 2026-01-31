/**
 * @fileoverview Message.ts 文件职责说明。
 */
export interface Message {
  from_id: number;
  user_id?: number;
  id: string;
  name: string;
  avatar: string;
  content: string;
  timestamp: string;
}

