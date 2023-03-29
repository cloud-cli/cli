import { CliCommand } from './cli-command.js';
import { CloudConfiguration, Configuration } from './configuration.js';

export { init } from './constants.js';

export function run(command: string, args: unknown, config: Configuration) {
  if (!config) {
    const loader = new CloudConfiguration();
    loader.loadCloudConfiguration();
    config = loader.settings;
  }

  const cli = new CliCommand(null);
  return cli.callServer(command, args, config);
}

