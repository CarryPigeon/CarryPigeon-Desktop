/**
 * @fileoverview fileApiImpl.ts 文件职责说明。
 */
import { tcpFileUploadAdapter } from "./tcpFileUploadAdapter";

export class FileAPIService{
    /**
     * requestUpload method.
     * @param server_socket - TODO.
     * @param size - TODO.
     * @param sha256 - TODO.
     * @returns TODO.
     */
    public async requestUpload(server_socket:string,size:number,sha256:string){
        await tcpFileUploadAdapter.requestUpload({ serverSocket: server_socket, size, sha256 });
    }
}

/**
 * Exported constant.
 * @constant
 */
export const FILE_API = new FileAPIService();
