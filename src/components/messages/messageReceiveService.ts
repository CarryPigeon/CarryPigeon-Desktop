import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import Avatar from '/test_avatar.jpg?url';
import type { Message } from './messageTypes';
import { getChannelId, getServerSocket } from './messageContext';
import { isIgnoredUser } from '../../script/store/ignoreStore';

const messages = ref<Message[]>([
  {
    id: '1',
    from_id: 1,
    name: '张三',
    avatar: Avatar,
    content: '你好！欢迎使用聊天系统。',
    timestamp: new Date().toLocaleTimeString(),
  },
  {
    id: '2',
    from_id: 2,
    name: '系统',
    avatar: Avatar,
    content: '这是一条系统消息，请开始您的对话。',
    timestamp: new Date().toLocaleTimeString(),
  },
]);

export class MessageReceiveService {
  private readonly channelName: string;
  private readonly channelServer: string;

  constructor(channelServer: string) {
    this.channelName = '';
    this.channelServer = channelServer;
  }

  public getChannelName() {
    return this.channelName;
  }
  public getChannelServer() {
    return this.channelServer;
  }

  public async showNewMessage(messageData: string) {
    try {
      const parsedData = JSON.parse(messageData);

      const newMessage: Message = {
        id: parsedData['id'],
        from_id: parsedData['user_id'],
        name: parsedData.name,
        avatar: Avatar,
        content: parsedData.message,
        timestamp: new Date().toLocaleTimeString(),
      };

      if (isIgnoredUser(newMessage.from_id)) return;
      messages.value.push(newMessage);

      try {
        const oldMessage: Message = await invoke('get_message', {
          serverSocket: getServerSocket(),
          channel_id: getChannelId(),
          message_id: newMessage.id,
        });

        if (newMessage.timestamp != oldMessage.timestamp) {
          await invoke('update_message', {
            serverSocket: getServerSocket(),
            message_id: newMessage.id,
            user_id: newMessage.from_id,
            channel_id: getChannelId(),
            content: newMessage.content,
            created_at: newMessage.timestamp,
          });
        }

        await invoke('crate_message', {
          serverSocket: getServerSocket(),
          message_id: newMessage.id,
          user_id: newMessage.from_id,
          channel_id: getChannelId(),
          content: newMessage.content,
          created_at: newMessage.timestamp,
          update_at: newMessage.timestamp,
        });
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }
}

export const messageReceiveService = new MessageReceiveService('');
