export class TaskRoute {
    private functionMap: Map<string, (...args: any[]) => Promise<any>> = new Map<string, (...args: any[]) => Promise<any>>();

    public register(route_path: string, handler: (...args: any[]) => Promise<any>) {
        this.functionMap.set(route_path, handler);
    }

    public async pushTaskToService(value: string) {
        const temp = JSON.parse(value);
        try {
            const handler = this.functionMap.get(temp);
            handler?.(value);
        } catch (e) {
            return;
        }
    }
}