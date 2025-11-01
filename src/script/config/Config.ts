import { invoke } from "@tauri-apps/api/core";

export const configPath: string = "./config";

export var Config = await getConfig();

async function getConfig() {
    return await invoke("get_config").then((config) => {
        return JSON.parse(<string>config);
    });
}

export {
    getConfig
};