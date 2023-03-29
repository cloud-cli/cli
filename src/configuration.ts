import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger.js';
import { init } from './constants.js';

export type CallableCommands = Record<string, Function>;
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
  apiPort: 80,
  apiHost: '0.0.0.0',
  remoteHost: 'localhost',
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
      const tools = config.default as CommandTree;

      this.importCommands(tools);
      this.settings = { ...defaults, ...config };
    } catch (error) {
      Logger.log(`Invalid cloud configuration file: ${filePath}`);
      Logger.log(error.message);
      throw error;
    }

    this.loadKey();
  }

  importCommands(tools: CommandTree) {
    this.commands.set(init, tools[init]);

    Object.entries(tools).forEach(([name, commands]) => {
      this.commands.set(name, commands);
    });
  }

  private loadKey() {
    if (this.settings.key) { return; }

    const keyPath = join(process.cwd(), 'key');

    if (!existsSync(keyPath)) {
      throw new Error(`Key not found at ${keyPath}`);
    }

    this.settings.key = readFileSync(keyPath, 'utf-8').trim();
  }

  loadModuleConfiguration(moduleName: string): ModuleConfiguration {
    const filePath = join(process.cwd(), 'configuration', `${moduleName}.json`);

    if (!existsSync(filePath)) {
      return {};
    }

    try {
      return this.readAndParse(filePath) as ModuleConfiguration;
    } catch (error) {
      Logger.log(`Invalid configuration file for ${moduleName}: ${error.message}`);
      throw error;
    }
  }

  protected readAndParse(filePath: string): object {
    return JSON.parse(String(readFileSync(filePath)));
  }
}
