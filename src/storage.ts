import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from './utils.js';
import { createHash } from 'node:crypto';

const extension = '.json';
const sha256 = (string: string) => createHash('sha256').update(string).digest('hex');

export function getStorage<T>(prefix: string, computeKey: (key: string) => string = sha256) {
  const dataPath = join(process.cwd(), 'data');
  const storagePath = join(dataPath, prefix + extension);

  mkdirSync(dataPath, { recursive: true });

  let store: Record<string, T>;

  const save = () => writeJson(storagePath, store);
  const load = () => (store = readJson(storagePath) || {});

  load();

  const get = (key: string): T | null => {
    load();
    return store[computeKey(key)] || null;
  };

  const has = (key: string): boolean => {
    load();
    return computeKey(key) in store;
  };

  const set = (key: string, value: any): boolean => {
    load();
    store[computeKey(key)] = value;
    save();
    return true;
  };

  const reset = (): boolean => {
    store = {};
    save();
    return true;
  };

  const update = (key: string, values: Partial<T>): boolean => {
    load();
    const previous = get(key);
    const next = Object.assign({}, previous, values);
    store[computeKey(key)] = next;
    save();
    return true;
  };

  const getAll = (): T[] => {
    load();
    return Object.values(store);
  };

  const remove = (key: string) => {
    load();
    delete store[computeKey(key)];
    save();
    return true;
  };

  return { get, set, reset, has, update, getAll, remove };
}
