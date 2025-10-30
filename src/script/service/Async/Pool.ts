import { Config } from "../../config/Config.ts";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WorkerPool = require("worker_pool").pool;
export const pool = WorkerPool({ maxWorkers: Config["maxWorkers"] });
