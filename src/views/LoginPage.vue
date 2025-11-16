<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const email = ref('');
const code = ref('');

const router = useRouter();

function login(){
    router.push('/chat');
}

</script>

<template>
<div class="login-page">
  <h1>{{ $t('login') }}</h1>
  <image class="user-image" alt="User Image"/>
  <input class="email-input" v-model="email" type="email" :placeholder="$t('email')" />
  <input class="code-input" v-model="code" type="password" :placeholder="$t('login_code')"/>
  <button @click="login">{{ $t('login') }}</button>
</div>
</template>

<style scoped lang="sass">
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
    width: 50%;
    padding: 10px;
    margin-top: 10px;
    margin-bottom: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
    box-sizing: border-box;
.code-input
    width: 50%;
    padding: 10px;
    margin-top: 10px;
    margin-bottom: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
    box-sizing: border-box;

.user-image
    width: 100px;
    height: 100px;
    border-radius: 50%;
    margin-bottom: 20px;
</style>
