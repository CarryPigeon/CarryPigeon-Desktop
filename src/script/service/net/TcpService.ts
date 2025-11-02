import { listen } from "@tauri-apps/api/event";
import { Config } from "../../config/Config.ts";
import { Encryption } from "../Encryption/Encryption.ts";
import { invoke } from "@tauri-apps/api/core";

export class TcpService {
    public encrypter?: Encryption;

    constructor(socket?: string) {
        if(socket)this.encrypter = new Encryption(socket);
        // 添加本频道到tcp_service中
        invoke("add_tcp_service", { socket });
    }
    
    public async send(channel_id: number,raw_data:string){
        return new Promise(() =>{
            let data = this.encrypter.encrypt(raw_data);
            invoke("send_tcp_service", { channel_id, data });
        });
    }

    public async listen(data:string) {
        let value = JSON.parse(data);
    }
}

listen<string>('tcp-message',(endata) => {
    TCP_SERVICE.listen(TCP_SERVICE.encrypter.decrypt(endata.payload));
})

export var TCP_SERVICE: TcpService = new TcpService(<string>Config["socket"]);
