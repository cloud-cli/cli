import * as FS from 'fs';
import * as Path from 'path';
import { Log } from './log.js';

const logger = Log.create('io');
const asyncFS = FS.promises;
const getFullPath = (...args: string[]) => Path.join(process.cwd(), ...args);

export function mkdirSync(...args: string[]): void {
  const folder = getFullPath(...args);
  logger.debug('mkdir', folder);

  FS.mkdirSync(folder, { recursive: true });
}

export function readFileSync(...file: string[]) {
  const path = getFullPath(...file);
  logger.debug('read', path);

  const buffer = FS.readFileSync(path);
  return buffer.toString('utf8').trim();
}

export async function readFile(...file: string[]) {
  const path = getFullPath(...file);
  logger.debug('read', path);

  const buffer = await asyncFS.readFile(path);
  return buffer.toString('utf8').trim();
}

export async function writeFile(...file: string[]) {
  const content = file.pop() || '';
  const path = getFullPath(...file);

  logger.debug('write', path);

  return await asyncFS.writeFile(path, content);
}

export async function deleteFile(...file: string[]) {
  const path = getFullPath(...file);
  logger.debug('delete', path);
  return await asyncFS.unlink(path);
}

export async function exists(...file: string[]) {
  return new Promise((resolve) => FS.exists(getFullPath(...file), resolve));
}

export async function existsSync(file: string) {
  return FS.existsSync(getFullPath(file));
}

export function join(...args: string[]) {
  return getFullPath(...args);
}

export function readDirectory(...args: string[]): string[] {
  const path = getFullPath(...args);
  logger.debug('readdir', path);

  try {
    const directory = FS.opendirSync(path, { encoding: 'utf8' });
    const entries = [];
    let entry;

    while ((entry = directory.readSync())) {
      entries.push(entry.name);
    }

    return entries;
  } catch {
    return [];
  }
}
