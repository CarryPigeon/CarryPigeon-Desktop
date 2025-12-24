import { TCP_SERVICE } from "../../script/service/net/TcpService";

interface FileUploadAPI {
    size: number|undefined;
    sha256: string|undefined;
}

export class FileAPIService{
    public async requestUpload(channel_socket:string,size:number,sha256:string){
        const context: FileUploadAPI = {
            size: size,
            sha256: sha256
        };
        const service = TCP_SERVICE.get(channel_socket);
        if (service) {
            await service.send(channel_socket,JSON.stringify(context));
        } else {
            console.error(`TcpService not found for socket: ${channel_socket}`);
        }
    }
}

