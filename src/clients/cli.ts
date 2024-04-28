import { CloudConfiguration } from '../configuration.js';
import { CliCommand } from '../cli-command.js';
import { HttpServer } from '../http-server.js';
import { Logger } from '../logger.js';

export class CommandLineInterface {
  protected http: HttpServer;
  protected cli: CliCommand;

  constructor(protected config = new CloudConfiguration()) {
    this.cli = new CliCommand(config);
  }

  async run(args: string[]) {
    await this.config.loadCloudConfiguration();

    if (!args.length || args[0] === '--help') {
      await this.showHelpAndExit();
      return;
    }

    try {
      const output = await this.cli.run(args);
      this.printOutput(output);
      return output;
    } catch (error) {
      console.error(error);
    }
  }

  printOutput(output: any) {
    if (output === undefined) return;

    if (typeof output === 'object' && output) {
      output = JSON.stringify(output, null, 2);
    }

    console.log(output);
  }

  async showHelpAndExit() {
    const commands = await this.fetchCommands();
    const entries = Object.entries(commands);

    if (!(commands && entries.length)) {
      Logger.log('No commands available.');
      process.exit(1);
    }

    Logger.log('Usage: cy <command>.<subcommand> --option=value\nAvailable commands:\n');

    entries.forEach((entry) => {
      const [command, subcommands] = entry;
      Logger.log(command);
      subcommands.forEach((name) => Logger.log('  ', name));
    });

    if (entries.length) {
      Logger.log(`\n\nExample:\n\n\t${entries[0][0]}.${entries[0][1][0]} --foo "foo"`);
    }

    process.exit(1);
  }

  async fetchCommands() {
    const { apiPort, remoteHost, key } = this.config.settings;
    const url = new URL(`${remoteHost}:${apiPort}/`);
    const headers = { authorization: key };
    const remote = await fetch(url, { method: 'POST', headers });

    if (!remote.ok) {
      console.debug(`Fetch command returned ${remote.status}: ${remote.statusText}`);
    }

    return (await remote.json()) as Record<string, string[]>;
  }
}
