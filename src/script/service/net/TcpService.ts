import axios, {AxiosInstance} from "axios";

export function crateConnection(socket: string):AxiosInstance  {
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

export async function getRequest(instance: AxiosInstance, path: string) {
    return await instance.get(path,{});
}

export async function postRequest(instance: AxiosInstance, path: string) {
    return await instance.post(path,{});
}

export async function putRequest(instance: AxiosInstance, path: string) {
    return await instance.put(path,{});
}

export async function deleteRequest(instance: AxiosInstance, path: string) {
    return await instance.delete(path,{});
}
