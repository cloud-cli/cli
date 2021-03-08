import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger.js';

const noop = () => {};

export function importRcFile() {
  const rcFile = join(process.cwd(), '.cloudyrc');

  if (!existsSync(rcFile)) {
    return;
  }

  try {
    const env = readAndParse(rcFile);
    Object.assign(process.env, env);
  } catch (error) {
    Logger.log(error.message);
  }
}

export function readModuleConfiguration(moduleName: string, key: string): object {
  const filePath = join(process.cwd(), 'configuration', `${moduleName}.json`);

  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const config = readAndParse(filePath);
    return config[key] || {};
  } catch (error) {
    Logger.log(`Invalid configuration file for ${moduleName}: ${error.message}`);
    return {};
  }
}

export async function loadDeclarationFile() {
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
