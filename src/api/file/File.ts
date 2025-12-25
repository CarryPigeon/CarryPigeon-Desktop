import { TCP_SERVICE } from "../../script/service/net/TcpService";

interface FileUploadAPI {
    size: number|undefined;
    sha256: string|undefined;
}

export class FileAPIService{
    public async requestUpload(server_socket:string,size:number,sha256:string){
        const context: FileUploadAPI = {
            size: size,
            sha256: sha256
        };
        const service = TCP_SERVICE.get(server_socket);
        if (service) {
            await service.send(server_socket,JSON.stringify(context));
        } else {
            console.error(`TcpService not found for socket: ${server_socket}`);
        }
    }
}

