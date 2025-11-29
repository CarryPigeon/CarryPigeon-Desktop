<script setup lang="ts">
import { useRouter } from 'vue-router';
import SettingInput from '../components/items/SettingModel/SettingInput.vue';
const router = useRouter();

</script>

<template>
    <div class="user-info-page">
        <p class="back-buttom" @click="router.back()">back</p>
        <div class="user-info-content">
            <h1>{{ $t('user-info') }}</h1>
            <img class="user_avatar" src="" alt="User Info Image" />
            <p>{{ $t('user_info_description') }}</p>

            <div class="setting-item-content">
                <hr />
                <SettingInput text='username' placeholder="" />
                <hr />
                <SettingInput text='email' placeholder="" />
                <hr />
            </div>
        </div>
    </div>
</template>

<style scoped lang="sass">
.user-info-page
  position: relative
  width: 100%
  height: 100vh
  padding: 60px 0 0 0
  box-sizing: border-box
.back-buttom
  position: absolute
  left: 20px
  top: 20px
  font-size: 16px
  color: #3B82F6
  cursor: pointer
.user-info-content
  position: absolute
  left: 20%
.user-avatar
  width: 150px
  height: 150px
  border-radius: 75px
  margin: 20px 0
.user-info-content
    position: fixed
    left: 20%
    top: 10%
    width: 60%
    height: 80%
    background-color: transparent
    overflow-y: auto
    -ms-overflow-style: none
    &::-webkit-scrollbar
      display: none
</style>