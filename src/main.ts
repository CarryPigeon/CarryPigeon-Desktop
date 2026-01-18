import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router/Router";
import { i18n } from "./i18n";
import "tdesign-vue-next/es/style/index.css";
import { Button, TreeSelect, Input } from "tdesign-vue-next";

const app = createApp(App);
app.use(router).use(i18n).use(Button).use(TreeSelect).use(Input);

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
