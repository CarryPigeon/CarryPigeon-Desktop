<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Input } from 'tdesign-vue-next';

const email = ref('');
const server_socket = ref('');
const code = ref('');
const loading = ref(false);

const router = useRouter();

async function login(){
    loading.value = true;
    await new Promise(resolve => setTimeout(resolve, 1000));
    router.push('/chat');
}

</script>

<template>
<div class="login-page">
  <div class="login-container">
    <h1>{{ $t('login') }}</h1>
    <image class="user-image" alt="User Image"/>
    <Input class="server-input" v-model="server_socket" type="text" :placeholder="$t('server_socket')" />
    <Input class="email-input" v-model="email" type="text" :placeholder="$t('email')" />
    <Input class="code-input" v-model="code" type="password" :placeholder="$t('login_code')"/>
    <button class = "login-button" @click="login">
        <span v-if="loading">{{ $t('loading') }}</span>
        <span v-else>{{ $t('login') }}</span>
    </button>
  </div>
</div>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  box-sizing: border-box;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 40% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
    pointer-events: none;
  }
}

.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  padding: 40px 60px;
  width: 100%;
  max-width: 400px;
  z-index: 1;
}

h1 {
  margin-bottom: 30px;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.user-image {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  margin-bottom: 20px;
  object-fit: cover;
}

.server-input{
  width: 100%;
  margin-top: 10px;
  margin-bottom: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
}

.email-input {
  width: 100%;
  margin-top: 10px;
  margin-bottom: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
}

.code-input {
  width: 100%;
  margin-top: 10px;
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
}

.login-button {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  
  &:active {
    transform: translateY(0);
  }
}
</style>
