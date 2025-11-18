<script setup lang="ts">
import setting from '/settings.svg?url';
import add from '/add.svg?url';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  avatar: String,
  name: String,
  description: String,
  id: Number,
})

const avatar = ref(props.avatar);
const name = ref(props.name);
const description = ref(props.description);
const id = ref(props.id);

const router = useRouter();

function click_setting(){
    router.push("/settings");
}

/*
function updateAvatar(newAvatar: string) {
  avatar.value = newAvatar;
}

function updateName(newName: string) {
  name.value = newName;
}

function updateDescription(newDescription: string) {
  description.value = newDescription;
}
*/
</script>

<template>
  <div class="container">
    <img class="image" :src="avatar" alt="avatar"/>
    <p class="username"> {{ name }} - {{ id }} </p>
    <p class="description"> {{ description }} </p>
    <img class="setting-icon" :src="setting" @click="click_setting" alt=""/>
    <img class="add-icon" :src="add" alt=""/>
  </div>
</template>

<style scoped lang="sass">
.container
  position: absolute
  left: 63px
  top: calc(100vh - 60px)
  width: 257px
  height: 60px
  opacity: 1
  background: rgba(229, 231, 235, 1)

.image
  background-size: 30px 30px
  left: 86px
  top: 654px
  width: 30px
  height: 30px
  opacity: 1
  background: rgba(204, 204, 204, 1)

.username
  position: fixed
  left: 128px
  top: calc(100vh - 60px)
  width: 57px
  height: 18px
  opacity: 1
  background: rgba(0, 0, 0, 1)
  /** 文本 */
  font-size: 12px
  font-weight: 400
  letter-spacing: 0
  line-height: 17.38px
  color: rgba(0, 0, 0, 1)
  text-align: left
  vertical-align: middle

.description
  position: fixed
  left: 128px
  top: calc(100vh - 36px)
  width: 91px
  height: 18px
  opacity: 1
  background: rgba(35, 66, 87, 1)
  /** 文本 */
  font-size: 12px
  font-weight: 400
  letter-spacing: 0
  line-height: 17.38px
  color: rgba(35, 66, 87, 1)
  text-align: left
  vertical-align: middle

.setting-icon
  position: fixed
  left: 239px
  top: calc(100vh - 39px)

.add-icon
  position: fixed
  left: 275px
  top: calc(100vh - 39px)
</style>
