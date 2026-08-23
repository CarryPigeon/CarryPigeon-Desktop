/**
 * Node 25+ 在未提供 --localstorage-file 时，globalThis.localStorage 为 undefined，
 * 会盖住 jsdom 的 window.localStorage。测试统一挂一份内存实现。
 */
const memory = new Map<string, string>();

const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  clear() {
    memory.clear();
  },
  getItem(key: string) {
    return memory.get(String(key)) ?? null;
  },
  key(index: number) {
    return Array.from(memory.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memory.delete(String(key));
  },
  setItem(key: string, value: string) {
    memory.set(String(key), String(value));
  },
};

if (typeof globalThis.localStorage?.setItem !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: memoryStorage,
  });
}
