import * as fs from "fs";
import path from "path";

export const configPath: string = "./config";

async function getConfig(filePath: string): Promise<any> {
    if (filePath == ""){
    }
    const absolutePath = path.resolve(filePath);
    fs.readFile(absolutePath, 'utf-8', (err, config) => {
        if (err) {
            // TODO: 弹窗提示错误
            console.error(err);
            return;
        }
        return JSON.parse(config);
    });
}

export {
    getConfig
};