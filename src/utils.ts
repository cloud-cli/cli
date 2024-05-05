import { existsSync, readFileSync, writeFileSync } from 'fs';

export function readJson<T>(path: string): T | null {
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as T;
    } catch {}
  }

  return null;
}

export function writeJson(path: string, value: any) {
  return writeFileSync(path, JSON.stringify(value, null, 2));
}
