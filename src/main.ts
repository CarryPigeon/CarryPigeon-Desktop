import { createApp, type Plugin } from "vue";
import App from "./App.vue";
import { router } from "./router/Router";
import { i18n } from "./i18n";
import "tdesign-vue-next/es/style/index.css";
import { Button, TreeSelect, Input, MessagePlugin } from "tdesign-vue-next";

const app = createApp(App);
app.use(router)
  .use(i18n)
  .use(Button)
  .use(MessagePlugin as unknown as Plugin)
  .use(TreeSelect)
  .use(Input);

const searchParams = new URLSearchParams(window.location.search);
const windowType = searchParams.get("window");

if (windowType === "user-popover") {
  router.replace({
    path: "/user-popover",
    query: {
      avatar: searchParams.get("avatar") ?? "",
      name: searchParams.get("name") ?? "",
      email: searchParams.get("email") ?? "",
      bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
    },
  });
} else if (windowType === "user-info") {
  router.replace("/user_info");
}

router.isReady().then(() => {
  app.mount("#app");
});
