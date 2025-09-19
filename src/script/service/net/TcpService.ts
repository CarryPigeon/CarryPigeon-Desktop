import axios, {AxiosInstance} from "axios";

export function createConnection(socket: string): AxiosInstance  {
    return axios.create({
        baseURL: socket,
        timeout: 5000,
    });
}

export async function connectServer(instance: AxiosInstance, path:string) {
    await instance.post(path, instance);
}

export async function keepAlive(instance: AxiosInstance) {
    await instance.get('/keepAlive',
        {
            headers: {
                'Connection': 'keep-alive',
            }
        }).catch(error => {
            console.log(error);
            //TODO: 弹窗提示，推荐重连
    });
}

export async function getRequest(instance: AxiosInstance, path: string, data:any) {
    return await instance.get(path,{
        params: {data}
    });
}

export async function postRequest(instance: AxiosInstance, path: string, data:string) {
    return await instance.post(path,{data});
}

export async function putRequest(instance: AxiosInstance, path: string, data:string) {
    return await instance.put(path,{data});
}

export async function deleteRequest(instance: AxiosInstance, path: string,data:string) {
    return await instance.delete(path,{data});
}
