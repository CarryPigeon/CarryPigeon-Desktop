<script setup lang="ts">
import { ref } from 'vue';
import Avatar from '/test_avatar.jpg?url';
import MessageBubbleComponents from './MessageBubbleComponents.vue';

const props = defineProps<{
  user_id: number,
}>();

</script>

<script lang="ts">
// 标记ServerSocket和ChannelId
import {invoke} from "@tauri-apps/api/core";

let serverSocket = ref<string>("");
let channelId = ref<number>(0);

export function setServerSocket(socket: string){
  serverSocket.value = socket;
}

export function getServerSocket(){
  return serverSocket.value;
}

export function setChannelId(id: number){
  channelId.value = id;
}

export function getChannelId(){
  return channelId.value;
}

// 定义消息接口
export interface Message {
  from_id: number;
  id: string;
  name: string;
  avatar: string;
  content: string;
  timestamp: string;
}

// 使用ref创建响应式消息列表，并添加初始的mock数据
const messages = ref<Message[]>([
  {
    id: '1',
    from_id: 1,
    name: '张三',
    avatar: Avatar,
    content: '你好！欢迎使用聊天系统。',
    timestamp: new Date().toLocaleTimeString()
  },
  {
    id: '2',
    from_id: 2,
    name: '系统',
    avatar: Avatar,
    content: '这是一条系统消息，请开始您的对话。',
    timestamp: new Date().toLocaleTimeString()
  }
]);

export class MessageReceiveService{
  private readonly channelName: string;
  private readonly channelServer: string;

  constructor(channelServer:string) {
    this.channelName = "";
    this.channelServer = channelServer;
  }

  public getChannelName(){
    return this.channelName;
  }
  public getChannelServer(){
    return this.channelServer;
  }
  
  
  // 处理接收到的新消息
  public async showNewMessage(messageData: string){
    try {
      // 尝试解析JSON数据
      const parsedData = JSON.parse(messageData);
      
      // 创建新消息对象
      const newMessage: Message = {
        id: parsedData["id"],
        from_id: parsedData["user_id"],
        name: parsedData.name,
        avatar: Avatar,
        content: parsedData.message,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      // 将新消息添加到消息列表
      messages.value.push(newMessage);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      //存储数据到数据库
      try{
        const oldMessage: Message = await invoke("get_message",{ serverSocket: serverSocket.value, channel_id: channelId.value, message_id: newMessage.id,});
        if (newMessage.timestamp != oldMessage.timestamp){
          await invoke("update_message", {
            serverSocket: serverSocket.value,
            message_id: newMessage.id,
            user_id: newMessage.from_id,
            channel_id: channelId.value,
            content: newMessage.content,
            created_at: newMessage.timestamp,
          });
        }
        await invoke("crate_message", {
          serverSocket: serverSocket.value,
          message_id: newMessage.id,
          user_id: newMessage.from_id,
          channel_id: channelId.value,
          content: newMessage.content,
          created_at: newMessage.timestamp,
          update_at: newMessage.timestamp
        });
      } catch (error) {
        // TODO:处理问题
      }
    } catch (error) {
      // TODO:处理问题
    }
  }
}
export var messageReceiveService = new MessageReceiveService("");
</script>

<template>
  <div class="chat-box-container">
    <!-- 使用v-for遍历消息数组，动态渲染消息组件 -->
    <MessageBubbleComponents :user_id="props.user_id" />
  </div>
</template>

<style scoped lang="sass">
.chat-box-container
  background-color: transparent
  position: fixed
  top: 61px
  left: 318px
  height: calc(65vh - 15px)
  width: calc(100vw - 558px)
  overflow-y: auto
</style>

