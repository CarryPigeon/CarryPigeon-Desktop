import { TCP_SERVICE } from "../../script/service/net/TcpService";

interface FileUploadAPI {
    size: number|undefined;
    sha256: string|undefined;
}

export class FileAPIService{
    public async requestUpload(size:number,sha256:string){
        const context: FileUploadAPI = {
            size: size,
            sha256: sha256
        };
        await TCP_SERVICE.send(JSON.stringify(context));
    }
}

