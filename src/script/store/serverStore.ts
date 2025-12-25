import { ref } from 'vue';

export const currentServerSocket = ref<string>('');

export function setServerSocket(socket: string) {
    currentServerSocket.value = socket;
}

export function getServerSocket(): string {
    return currentServerSocket.value;
}
