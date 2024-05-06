import { callServer } from './call-server.js';
import { Settings, getCloudyConfig } from './configuration.js';

export { init, events, logInfo, logError } from './constants.js';
export { getConfig } from './configuration.js';
export { getStorage } from './storage.js';
export { readJson, writeJson } from './utils.js';
export type { ServerParams } from './http-server.js';
export type { WithAdditionalOptions } from './types.js';

export async function run(command: string, args?: Record<string, any>, settings?: Settings) {
  settings ||= await getCloudyConfig();
  return callServer(command, args, settings);
}
