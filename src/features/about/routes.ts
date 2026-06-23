import type { RouteRecordRaw } from "vue-router";

const AboutPage = () => import("./presentation/pages/AboutPage.vue");

export const aboutRoutes: RouteRecordRaw[] = [
  { path: "/about", component: AboutPage, name: "about" },
];
