import * as net from "node:net";
import {pushTask} from "./praseJsonBody.ts";
import { Config} from "../../config/Config.ts";

class TcpService {
    public client: net.Socket

    constructor(socket: string) {
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
        this.client.write(data);
    }

    public receive(callback: (data: string) => void) {
        this.client.on("data", (data) => {
            callback(data.toString());
        });
    }

}

export var TCP_SERVICE: TcpService = new TcpService(Config["socket"]);

export { TcpService }
