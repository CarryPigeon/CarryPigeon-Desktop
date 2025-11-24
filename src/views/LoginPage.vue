<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Input } from 'tdesign-vue-next';

const email = ref('');
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
  <h1>{{ $t('login') }}</h1>
  <image class="user-image" alt="User Image"/>
  <Input class="email-input" v-model="email" type="text" :placeholder="$t('email')" />
  <Input class="code-input" v-model="code" type="password" :placeholder="$t('login_code')"/>
  <button class = "login-button" @click="login">
      <span v-if="loading">{{ $t('loading') }}</span>
      <span v-else>{{ $t('login') }}</span>
  </button>
</div>
</template>

<style scoped lang="sass">
.user-image
    width: 100px;
    hight: 100px;
.login-page
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
    background-color: #f5f5f5;
    padding: 20px;
    box-sizing: border-box;

.email-input
    padding: 0
    width: 50%
    padding: 0px
    margin-top: 10px
    margin-bottom: 10px
    border: 1px solid #ccc
    border-radius: 4px
    font-size: 16px
    box-sizing: border-box
.code-input
    width: 50%
    padding: 0
    margin-top: 10px
    margin-bottom: 10px
    border: 1px solid #ccc
    border-radius: 4px
    font-size: 16px
    box-sizing: border-box

.user-image
    width: 100px
    height: 100px
    border-radius: 50%
    margin-bottom: 20px
</style>
