import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadKey } from './authorization.js';
import { Logger } from './logger.js';
import { CommandTree } from './types.js';
import { readJson } from './utils.js';

export interface ModuleConfiguration {
  commands?: Record<string, object>;
  [k: string]: any;
}

export interface Settings {
  default?: CommandTree;
  apiPort?: number;
  apiHost?: string;
  key?: string;
  remoteHost?: string;
  invalidKeyPenalty?: number;
}

const _ = process.env;

const defaults: Settings = {
  apiPort: Number(_.CLOUDY_PORT || 1234),
  apiHost: _.CLOUDY_HOST || '127.0.0.1',
  remoteHost: _.CLOUDY_REMOTE_HOST || 'http://127.0.0.1',
  key: _.CLOUDY_TOKEN || '',
  invalidKeyPenalty: 5000,
};

export async function getCloudyConfig(filePath?: string): Promise<Settings> {
  filePath ||= findFile();

  if (!filePath) {
    throw new Error('Configuration file not found');
  }

  try {
    const mod = await import(filePath);
    const configuration = { ...defaults, ...mod };
    configuration.key ||= await loadKey();

    if (!configuration.key) {
      throw new Error('[error] A key must be define before we continue.');
    }

    return configuration;
  } catch (error) {
    Logger.log(error.message);
    Logger.log(`[error] Invalid cloud configuration file at ${filePath}`);
    throw error;
  }
}

export function findFile(): string {
  const candidates = [join(process.cwd(), 'cloudy.conf.mjs'), '~/cloudy.conf.mjs'];

  if (process.env.HOME) {
    candidates.push(join(process.env.HOME, 'cloudy.conf.mjs'));
  }

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return '';
}

export function getConfig<T extends ModuleConfiguration>(moduleName: string, defaults: T = null): T {
  const filePath = join(process.cwd(), 'configuration', `${moduleName}.json`);
  const config = readJson<T>(filePath);

  return Object.assign({}, defaults, config);
}
