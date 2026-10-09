import { readFileSync } from 'node:fs';
import yargs from 'yargs';
import { callServer } from '../call-server.js';
import { Settings } from '../configuration.js';
import { Logger } from '../logger.js';

export class CommandLineInterface {
  constructor(protected settings: Settings) {}

  async run(args: string[]) {
    if (!args.length || args[0] === '--help') {
      await this.showHelpAndExit();
      return;
    }

    // Check if --help follows a command name (e.g., "cy <name> --help")
    const helpArgIndex = args.indexOf('--help');
    if (helpArgIndex > 0 && helpArgIndex === args.length - 1) {
      const command = args[helpArgIndex - 1];
      const output = await this.fetchModuleHelp(command);
      if (output !== undefined) {
        this.printOutput(output);
      }
      return;
    }

    try {
      const [command, ...params] = args;
      const jsonArgs = await this.parseParamsFromCli(params);
      const output = await callServer(command, jsonArgs, this.settings);
      this.printOutput(output);
      return output;
    } catch (error) {
      console.error(error);
    }
  }

  printOutput(output: any) {
    if (output === undefined) {
      return;
    }

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
    const { apiPort, remoteHost, key } = this.settings;
    const url = new URL(`${remoteHost}:${apiPort}/.help`);
    const headers = { authorization: key };
    const remote = await fetch(url, { method: 'POST', headers });

    if (!remote.ok) {
      console.debug(`Fetch command returned ${remote.status}: ${remote.statusText}`);
      return {};
    }

    return (await remote.json()) as Record<string, string[]>;
  }

  async fetchModuleHelp(command: string) {
    const { apiPort, remoteHost, key } = this.settings;
    const url = new URL(`${remoteHost}:${apiPort}/.help/${encodeURIComponent(command)}`);
    const headers = { authorization: key };
    const remote = await fetch(url, { method: 'POST', headers });

    if (!remote.ok) {
      console.debug(`Fetch module help returned ${remote.status}: ${remote.statusText}`);
      return undefined;
    }

    try {
      const data = (await remote.json()) as { command: string; help: string };
      return data.help || undefined;
    } catch {
      return undefined;
    }
  }

  private async parseParamsFromCli(input: string[]) {
    const { argv } = yargs(input);
    const { $0, ...params } = await argv;

    this.readFileReferences(params);

    return params;
  }

  private readFileReferences(params: Record<string, unknown>) {
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'object') {
        return this.readFileReferences(value as any);
      }

      if (String(value).startsWith('@file:')) {
        params[key] = readFileSync(String(value).slice(6), { encoding: 'utf-8' });
      }
    });
  }
}
