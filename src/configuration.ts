import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger.js';

export class Configuration {
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

  readAndParse(filePath: string): object {
    return JSON.parse(String(readFileSync(filePath)));
  }
}

export interface ModuleConfiguration {
  port?: number;
  host?: string;
  commands?: {
    [command: string]: object;
  };
}
