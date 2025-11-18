import {createRouter, createWebHistory} from "vue-router";
import LoginPage from "../views/LoginPage.vue";

export const router = createRouter({
    history: createWebHistory(),
    routes:[
        { path: '/', component: LoginPage},
        { path: '/chat', component: () => import("../views/MainPage.vue")},
        { path: '/settings', component: () => import("../views/SettingPage.vue") }
    ]
});
