import { CliCommand } from './cli-command.js';
import { CloudConfiguration, Configuration } from './configuration.js';

export { init, events, logInfo, logError } from './constants.js';
export { getConfig } from './configuration.js';
export { getStorage } from './storage.js';
export type { ServerParams } from './http-server.js';

export async function run(command: string, args?: Record<string, any>, config?: Configuration) {
  if (!config) {
    const loader = new CloudConfiguration();
    await loader.loadCloudConfiguration();
    config = loader.settings;
  }

  const cli = new CliCommand(null);
  return cli.callServer(command, args, config);
}

