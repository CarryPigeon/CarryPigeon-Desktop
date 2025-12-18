import { createRouter, createWebHistory } from "vue-router";
import LoginPage from "../views/LoginPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/channels/new", component: () => import("../views/AddChannelPage.vue") },
    { path: "/", component: LoginPage },
    { path: "/chat", component: () => import("../views/MainPage.vue") },
    { path: "/settings", component: () => import("../views/SettingPage.vue") },
    {
      path: "/user_info",
      name: "UserInfoPage",
      component: () => import("../views/UserInfoPage.vue"),
    },
    { path: "/user-popover", component: () => import("../views/UserPopoverPage.vue") },
  ],
});
