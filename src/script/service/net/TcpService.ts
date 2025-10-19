import * as net from "node:net";
import {pushTask} from "./praseJsonBody.ts";
import { Config} from "../../config/Config.ts";
import { Encryption } from "../Encryption/Encryption.ts";

class TcpService {
    public client: net.Socket
    public encrypter: Encryption

    constructor(socket: string) {
        this.encrypter = new Encryption(socket);
        this.client = net.connect(socket);
    }

    public createConnection(socket: string)  {
        const client = new net.Socket();
        return client.connect(socket,() =>{
            client.on("data",(data:string) => {
                pushTask(data)
            })
            client.on("close", () => { client.end(); });
        });
    }

    public send(data: string) {
        let en_data = this.encrypter?.decrypt(data);
         this.client.write(en_data);
    }

    public receive(callback: (data: string) => any) {
        this.client.on("data", (data) => {
            callback(this.encrypter.decrypt(data.toString()));
        });
    }

}

export var TCP_SERVICE: TcpService = new TcpService(Config["socket"]);

export { TcpService }
