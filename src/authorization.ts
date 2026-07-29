import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from './logger.js';
import type { Settings } from './configuration.js';

export function validateKey(request, response, settings: Settings) {
  const remoteKey = String(request.headers.authorization?.toLowerCase() || '').replace('bearer', '').trim();

  if (settings.key !== remoteKey) {
    Logger.debug(`Invalid key: ${remoteKey}, expected ${settings.key}`);

    setTimeout(() => {
      response.writeHead(404, 'Not found');
      response.end();
    }, settings.invalidKeyPenalty);
    return false;
  }

  return true;
}

export async function loadKey() {
  const keyPath = join(process.cwd(), 'key');
  if (existsSync(keyPath)) {
    return (await readFile(keyPath, 'utf-8')).trim();
  }
}
