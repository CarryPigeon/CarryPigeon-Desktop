import {createApp} from "vue";
import App from "./App.vue";
import { router } from "./router/Router";
import { i18n } from "./i18n/index";

createApp(App).use(router).use(i18n).mount("#app")
