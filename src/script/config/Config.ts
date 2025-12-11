import { invoke } from "@tauri-apps/api/core";

export const configPath: string = "./config";

export let Config = await getConfig();

async function getConfig() {
    return await invoke("get_config").then((config) => {
        return JSON.parse(<string>config);
    });
}

export async function changeConfig(key: string, value: string | boolean) {
    if (typeof value === 'boolean') {
        await invoke("update_config_bool", { key, value });
    } else if (typeof value === 'string') {
        await invoke("update_config_string", { key, value });
    }
    Config = await getConfig();
}

export {
    getConfig
};