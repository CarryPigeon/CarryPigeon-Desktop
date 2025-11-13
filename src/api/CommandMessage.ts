export type DataObject = Record<string, unknown>;

export interface CommandMessage{
    route: string,
    data?: DataObject,
}