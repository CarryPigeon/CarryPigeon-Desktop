import {JSONDict} from "./Data.ts";


export interface CommonNotificationMessageInterface {
    id: number,
    route: string,
    data: JSONDict,
}

export class CommonNotificationMessage implements CommonNotificationMessageInterface{
    constructor(public id: number, public route: string, public data: JSONDict) {
        this.id = id;
        this.route = route;
        this.data = data;
    }
}