import {Config} from "../../config/Config.ts";

export const WorkerPool = require('worker_pool').pool;
export const pool = WorkerPool({maxWorkers: Config["maxWorkers"]});
