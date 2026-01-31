/**
 * @fileoverview PushMessages.ts 文件职责说明。
 */
export interface MessageCommon {
  route: string;
  data: {
    scontent: string;
    cid: string;
    uid: string;
    send_time: string;
  };
}

export interface UIMessageCommon {
  route: string;
  data: string;
}

