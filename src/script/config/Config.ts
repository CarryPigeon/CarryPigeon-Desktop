import * as fs from "fs";
import path from "path";

export const configPath: string = "./config";

export var Config = getConfig(configPath);

function createInitConfig() {
    return {
        socket: "",
     };
}

function getConfig(filePath: string) {
    if (filePath == ""){
        // TODO: 创建初始化配置文件
        return createInitConfig();
    }
    const absolutePath = path.resolve(filePath);
    fs.readFile(absolutePath, 'utf-8', (err, config) => {
        if (err) {
            // TODO: 创建初始化配置文件
            console.error(err);
            return createInitConfig();
        }
        return JSON.parse(config);
    });
}

export {
    getConfig
};