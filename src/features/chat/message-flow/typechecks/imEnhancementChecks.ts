import type { ChatMessageRecord, ChatSendMessageInput, ChatUnreadState } from "@/features/chat/domain/types/chatApiModels";

const replyRecord: ChatMessageRecord = {
  id: "m1",
  channelId: "c1",
  userId: "u1",
  sentTime: 1,
  domain: "Core:Text",
  domainVersion: "1.0.0",
  data: { text: "hello" },
  replyToMessageId: "m0",
  replyTo: {
    messageId: "m0",
    senderName: "Alice",
    preview: "previous",
    createdAt: 0,
  },
  mentions: [{ userId: "u2", displayName: "Bob" }],
};

const sendInput: ChatSendMessageInput = {
  domain: "Core:Text",
  domainVersion: "1.0.0",
  data: { text: "@Bob hello" },
  replyTo: replyRecord.replyTo,
  mentions: [{ userId: "u2", displayName: "Bob" }],
};

const unread: ChatUnreadState = {
  channelId: "c1",
  unreadCount: 2,
  mentionUnreadCount: 1,
  lastReadTime: 1,
};

void replyRecord;
void sendInput;
void unread;
