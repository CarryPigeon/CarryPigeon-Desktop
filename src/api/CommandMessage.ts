export type DataObject = Record<string, any>;

export interface CommandMessage{
    route: string,
    data?: DataObject,
}