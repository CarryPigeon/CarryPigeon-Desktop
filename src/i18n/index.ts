import { createI18n } from 'vue-i18n';
import { zh_cn } from './zh_cn';

export const i18n = createI18n({
    locale: 'zh_cn',
    messages:{
        zh_cn: zh_cn,
    }
})