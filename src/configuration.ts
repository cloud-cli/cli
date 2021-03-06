import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger';

export function importRcFile() {
  const rcFile = join(process.cwd(), '.cloudyrc');

  if (!existsSync(rcFile)) {
    return;
  }

  try {
    Object.assign(process.env, readAndParse(rcFile));
  } catch (error) {
    Logger.log(error.message);
  }
}

export function readModuleConfiguration(moduleName: string): object {
  const filePath = join(process.cwd(), 'configuration', moduleName, 'config.json');

  if (!existsSync(filePath)) {
    return {};
  }

  try {
    return readAndParse(filePath);
  } catch (error) {
    Logger.log(`Invalid configuration file for ${moduleName}: ${error.message}`);
    return {};
  }
}

function readAndParse(filePath: string): object {
  return JSON.parse(String(readFileSync(filePath)));
}
