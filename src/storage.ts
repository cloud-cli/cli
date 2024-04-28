import { existsSync, mkdirSync } from 'node:fs';
import { readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson } from './utils.js';

const extension = '.json';

export function getStorage<T>(prefix) {
  const storagePath = join(process.cwd(), 'data', prefix);

  mkdirSync(storagePath, { recursive: true });

  const get = (key: string): T | null => {
    const path = join(storagePath, key + extension);
    return readJson(path);
  };

  const set = async (key: string, value: any): Promise<boolean> => {
    await writeFile(join(storagePath, key + extension), JSON.stringify(value), 'utf-8');
    return true;
  };

  const update = async (key: string, values: any): Promise<boolean> => {
    const previous = await get(key);
    const next = Object.assign({}, previous || {}, values);
    await writeFile(join(storagePath, key + extension), JSON.stringify(next), 'utf-8');
    return true;
  };

  const getKeys = async (): Promise<string[]> => {
    const all = await readdir(storagePath, { withFileTypes: true });
    return all.filter((f) => f.isFile() && f.name.endsWith(extension)).map((f) => f.name.replace(extension, ''));
  };

  const getAll = async (): Promise<T[]> => {
    const keys = await getKeys();
    const all = [];

    for (const next of keys) {
      all.push(await get(next));
    }

    return all;
  };

  const remove = async (key: string) => {
    const path = join(storagePath, key + extension);

    if (existsSync(path)) {
      await rm(join(storagePath, key + extension));
      return true;
    }

    return false;
  };

  return { get, set, update, getKeys, getAll, remove };
}
