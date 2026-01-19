import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router/Router";
import { i18n } from "./i18n";
import "tdesign-vue-next/es/style/index.css";

const app = createApp(App);
app.use(router).use(i18n);

const searchParams = new URLSearchParams(window.location.search);
const windowType = searchParams.get("window");

if (windowType === "user-info-popover") {
  router.replace({
    path: "/user-info-popover",
    query: {
      avatar: searchParams.get("avatar") ?? "",
      name: searchParams.get("name") ?? "",
      email: searchParams.get("email") ?? "",
      bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
    },
  });
} else if (windowType === "channel-info-popover") {
  router.replace({
    path: "/channel-info-popover",
    query: {
      avatar: searchParams.get("avatar") ?? "",
      name: searchParams.get("name") ?? "",
      bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
    },
  });
}

router.isReady().then(() => {
  app.mount("#app");
});
