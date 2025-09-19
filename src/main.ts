import {createApp} from "vue";
import App from "./App.vue";
import {createRouter, createWebHistory} from "vue-router";
//import LoginPage from "./views/LoginPage.vue";
import MainPage from "./views/MainPage.vue";
//import {getConfig} from "./script/config/Config.ts";

const router = createRouter({
    history: createWebHistory(),
    routes:[
        { path: '/', component: MainPage},
    ]
});

declare var config: any;
//config = await getConfig("");

createApp(App).use(router).mount("#app")
