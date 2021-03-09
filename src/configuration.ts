import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger.js';

const noop = () => {};

export function readModuleConfiguration(moduleName: string): ModuleConfiguration {
  const filePath = join(process.cwd(), 'configuration', `${moduleName}.json`);

  if (!existsSync(filePath)) {
    throw new Error(`Missing configuration file for ${moduleName}`);
  }

  try {
    return readAndParse(filePath) as ModuleConfiguration;
  } catch (error) {
    Logger.log(`Invalid configuration file for ${moduleName}: ${error.message}`);
    throw error;
  }
}

export async function loadCloudConfigurationFile() {
  const filePath = join(process.cwd(), 'cloudy.conf.js');

  if (!existsSync(filePath)) {
    Logger.log(`Configuration file at ${filePath} not found`);
    return;
  }

  try {
    const main = await import(filePath);
    return main.default || noop;
  } catch (error) {
    Logger.log(`Invalid configuration file: ${filePath}`);
    Logger.log(error.message);
  }
}

function readAndParse(filePath: string): object {
  return JSON.parse(String(readFileSync(filePath)));
}

export interface CloudConfiguration {
  [module: string]: ModuleConfiguration;
}

export interface ModuleConfiguration {
  port: number;
  commands?: {
    [command: string]: object;
  };
}
