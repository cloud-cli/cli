import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Logger } from './logger.js';
import { init } from './constants.js';

export type CallableCommands = Record<string | typeof init, Function>;
export type CommandTree = Record<string | typeof init, CallableCommands>;

export interface ModuleConfiguration {
  commands?: Record<string, object>;
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
  commands = new Map<string | typeof init, CallableCommands>();
  settings: Configuration;

  async loadCloudConfiguration(): Promise<void> {
    const filePath = join(process.cwd(), 'cloudy.conf.mjs');

    if (!existsSync(filePath)) {
      Logger.log(`Configuration file not found at ${filePath}`);
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
    const tools = (this.settings.default || {}) as CommandTree;
    const pkg = await readFile(join(process.cwd(), 'package.json'), 'utf8');
    const prefix = '@cloud-cli/';
    const modules = Object.keys(JSON.parse(pkg).dependencies || {}).filter((k) => k.startsWith(prefix));

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
    if (this.settings.key) {
      return;
    }

    const keyPath = join(process.cwd(), 'key');

    if (!existsSync(keyPath)) {
      throw new Error(`Key not found at ${keyPath}`);
    }

    this.settings.key = (await readFile(keyPath, 'utf-8')).trim();
  }

  async loadModuleConfiguration(moduleName: string): Promise<ModuleConfiguration> {
    const filePath = join(process.cwd(), 'configuration', `${moduleName}.json`);

    try {
      if (existsSync(filePath)) {
        return (await this.readAndParse(filePath)) as ModuleConfiguration;
      }
    } catch (error) {
      Logger.log(`Invalid configuration file for ${moduleName}: ${error.message}`);
    }

    return {};
  }

  protected async readAndParse(filePath: string): Promise<object> {
    return JSON.parse(String(await readFile(filePath, 'utf-8')));
  }
}
