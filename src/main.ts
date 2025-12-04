import {createApp} from "vue";
import App from "./App.vue";
import { router } from "./router/Router";
import { i18n } from "./i18n/index";
import 'tdesign-vue-next/es/style/index.css';
import {Button, TreeSelect, Input} from "tdesign-vue-next";

createApp(App).use(router)
    .use(i18n)
    .use(Button)
    .use(TreeSelect)
    .use(Input)
    .mount("#app")
