import * as fs from "fs";
import path from "path";

export const configPath: string = "./config";

export var Config = getConfig(configPath);

function createInitConfig() {
    return {
        maxWorkers: 4,
        socket: "",
     };
}

function getConfig(filePath: string) {
    if (filePath == ""){
        // TODO: 创建初始化配置文件
        return createInitConfig();
    }
    const absolutePath = path.resolve(filePath);
    try {
        const config = fs.readFileSync(absolutePath, 'utf-8');
        return JSON.parse(config);
    } catch (err) {
        // TODO: 创建初始化配置文件
        console.error(err);
        return createInitConfig();
    }
}

export {
    getConfig
};