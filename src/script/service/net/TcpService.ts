import * as net from "node:net";
import {pushTask} from "./praseJsonBody.ts";

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

}

export { TcpService }
