import {createRouter, createWebHistory} from "vue-router";
import LoginPage from "../views/LoginPage.vue";
import MainPage from "../views/MainPage.vue";

export const router = createRouter({
    history: createWebHistory(),
    routes:[
        { path: '/', component: LoginPage},
        { path: '/chat', component: MainPage}
    ]
});
