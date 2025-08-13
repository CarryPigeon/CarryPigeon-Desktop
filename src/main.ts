import {createApp} from "vue";
import App from "./App.vue";
import {createRouter, createWebHistory} from "vue-router";
//import LoginPage from "./views/LoginPage.vue";
import MainPage from "./views/MainPage.vue";

const router = createRouter({
    history: createWebHistory(),
    routes:[
        { path: '/', component: MainPage},
    ]
});

createApp(App).use(router).mount("#app");
