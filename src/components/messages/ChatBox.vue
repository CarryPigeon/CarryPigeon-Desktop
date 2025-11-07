<script setup lang="ts">
import { ref } from 'vue';
import MemberMessageBubble from "./MemberMessageBubble.vue";
import Avatar from '/test_avatar.jpg?url';

// 标记ServerSocket和ChannelId
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
interface Message {
  id: string;
  name: string;
  avatar: string;
  content: string;
  date: string;
}

// 使用ref创建响应式消息列表，并添加初始的mock数据
const messages = ref<Message[]>([
  {
    id: '1',
    name: '张三',
    avatar: Avatar,
    content: '你好！欢迎使用聊天系统。',
    date: new Date().toLocaleTimeString()
  },
  {
    id: '2',
    name: '系统',
    avatar: Avatar,
    content: '这是一条系统消息，请开始您的对话。',
    date: new Date().toLocaleTimeString()
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
  public showNewMessage(messageData: string){
    try {
      // 尝试解析JSON数据
      const parsedData = JSON.parse(messageData);
      
      // 创建新消息对象
      const newMessage: Message = {
        id: Date.now().toString(),
        name: parsedData.name || '未知用户',
        avatar: Avatar,
        content: parsedData.message || messageData,
        date: new Date().toLocaleTimeString()
      };
      
      // 将新消息添加到消息列表
      messages.value.push(newMessage);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // 如果不是有效JSON，直接使用原始数据
      const newMessage: Message = {
        id: Date.now().toString(),
        name: '系统',
        avatar: Avatar,
        content: messageData,
        date: new Date().toLocaleTimeString()
      };
      
      // 将新消息添加到消息列表
      messages.value.push(newMessage);
    }
  }
}
export var messageReceiveService = new MessageReceiveService("");
</script>

<template>
  <div class="chat-box-container">
    <!-- 使用v-for遍历消息数组，动态渲染消息组件 -->
    <MemberMessageBubble
      v-for="message in messages"
      :key="message.id"
      :name="message.name"
      :avatar="message.avatar"
      :message="message.content"
      :date="message.date"
    ></MemberMessageBubble>
  </div>
</template>

<style scoped lang="sass">
.chat-box-container
  background-color: transparent
  position: fixed
  top: 61px
  left: 318px
  height: calc(100vh - 161px)
  width: calc(100vw - 558px)
  overflow-y: auto
</style>

