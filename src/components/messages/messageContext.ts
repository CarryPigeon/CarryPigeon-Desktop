import { ref } from 'vue';

const serverSocket = ref<string>('');
const channelId = ref<number>(0);

export function setServerSocket(socket: string) {
  serverSocket.value = socket;
}

export function getServerSocket() {
  return serverSocket.value;
}

export function setChannelId(id: number) {
  channelId.value = id;
}

export function getChannelId() {
  return channelId.value;
}
