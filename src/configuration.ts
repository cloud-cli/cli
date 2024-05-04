import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from './logger.js';
import { init } from './constants.js';
import { readJson } from './utils.js';

export type CallableCommands = {
  [init]?: Function;
  [k: string]: Function;
};

export type CommandTree = {
  [init]?: Function;
  [k: string]: CallableCommands;
};

export interface ModuleConfiguration {
  commands?: Record<string, object>;
  [k: string]: any;
}

export interface Configuration {
  default: CommandTree;
  apiPort?: number;
  apiHost?: string;
  key?: string;
  remoteHost?: string;
}

const defaults: Partial<Configuration> = {
  apiPort: 1234,
  apiHost: '0.0.0.0',
  remoteHost: 'http://127.0.0.1',
  key: '',
};

export class CloudConfiguration {
  commands = new Map<string | typeof init, CallableCommands | Function>();
  settings: Configuration;

  static findFile() {
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

  async loadCloudConfiguration(): Promise<void> {
    const filePath = CloudConfiguration.findFile();

    if (!filePath) {
      Logger.log(`Configuration file not found`);
      this.settings = defaults as Configuration;
      return;
    }

    try {
      const config = await import(filePath);
      this.settings = { ...defaults, ...config };
      await this.loadKey();
    } catch (error) {
      Logger.log(`Invalid cloud configuration file: ${filePath}`);
      Logger.log(error.message);
      throw error;
    }
  }

  importCommands(tools: CommandTree) {
    this.commands.set(init, tools[init]);

    Object.entries(tools).forEach(([name, commands]) => {
      this.commands.set(name, commands);
    });
  }

  async autoLoadModules() {
    const tools = (this.settings?.default || {}) as CommandTree;
    const pkg = await import(join(process.cwd(), 'package.json'), { assert: { type: 'json' } });
    const dependencies = pkg.default.dependencies || {};
    const prefix = '@cloud-cli/';
    const modules = Object.keys(dependencies).filter((k) => k.startsWith(prefix));

    Logger.debug(`Found ${modules.length} modules`);

    for (const name of modules) {
      try {
        const m = await import(name);
        if (m.default && typeof m.default === 'object') {
          Logger.debug('Loaded commands from ' + name);
          tools[name.replace(prefix, '')] = m.default;
        }
      } catch {
        Logger.log('Failed to load ' + name);
      }
    }

    this.importCommands(tools);
  }

  private async loadKey() {
    const keyPath = join(process.cwd(), 'key');
    if (!this.settings.key && existsSync(keyPath)) {
      this.settings.key = (await readFile(keyPath, 'utf-8')).trim();
    }
  }
}

export async function getConfig(moduleName: string): Promise<ModuleConfiguration> {
  const filePath = join(process.cwd(), 'configuration', `${moduleName}.json`);
  const config = readJson<ModuleConfiguration>(filePath);
  return config || {};
}
