import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yargs from 'yargs';
import { Configuration } from './configuration.js';
import { Logger } from './logger.js';

export type CallableCommands = Record<string, Function>;

export class CommandLineInterface {
  private commands = new Map<string, CallableCommands>();
  protected configuration = new Configuration();

  protected async loadCloudConfiguration(): Promise<Array<[string, CallableCommands]>> {
    const filePath = join(process.cwd(), 'cloudy.conf.mjs');

    if (!existsSync(filePath)) {
      Logger.log(`Configuration file at ${filePath} not found`);
      return [];
    }

    try {
      return (await import(filePath)).default;
    } catch (error) {
      Logger.log(`Invalid cloud configuration file: ${filePath}`);
      Logger.log(error.message);
      throw error;
    }
  }

  async run(args: string[]) {
    const tools = await this.loadCloudConfiguration();

    Array.from(tools).forEach(([name, commands]) => {
      this.commands.set(name, commands);
    });

    if (!args.length || args[0] === '--help') {
      this.showHelpAndExit();
    }

    if (args[0] == '--serve') {
      return this.startServices();
    }

    this.runCommandFromArgs(args);
  }

  private startServices() {
    Logger.log('Starting services...');

    this.commands.forEach((command, name) => {
      const configuration = this.configuration.loadModuleConfiguration(name);

      if (command.start) {
        command.start(configuration);
      }
    });
  }

  async runCommandFromArgs(args: string[]) {
    const [command, functionName, ...params] = args;
    const target = this.commands.get(command);

    if (!target || !functionName || !target[functionName]) {
      Logger.log(`Invalid command: ${command} ${functionName || ''}`);
      this.showHelpAndExit();
    }

    try {
      const moduleConfig = this.configuration.loadModuleConfiguration(command);
      const optionsFromCli = this.parseParamsFromCli(params);
      const optionFromFile = (moduleConfig.commands && moduleConfig.commands[functionName]) || {};
      const mergedOptions = Object.assign({}, optionsFromCli, optionFromFile);

      Logger.debug(`Running command: ${command} ${functionName}`, mergedOptions);
      const output = await target[functionName](mergedOptions);
      this.printOutput(output);

      process.exit(0);
    } catch (error) {
      Logger.log(error.message);
      process.exit(1);
    }
  }

  private printOutput(output: any) {
    if (output === undefined) return;

    if (typeof output === 'object' && output) {
      output = JSON.stringify(output);
    }

    Logger.log(output);
  }

  private parseParamsFromCli(input: string[]) {
    const { argv } = yargs(input);
    const { _, $0, ...params } = argv;

    this.readFileReferences(params);

    return params;
  }

  private readFileReferences(params: Record<string, unknown>) {
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'object') {
        return this.readFileReferences(value as any);
      }

      if (String(value).startsWith('@')) {
        params[key] = readFileSync(String(value).slice(1), { encoding: 'utf-8' });
      }
    });
  }

  private showHelpAndExit(): void {
    if (!this.commands.size) {
      Logger.log('No commands were declared.');
      process.exit(1);
    }

    Logger.log('Usage: cy --serve');
    Logger.log('Usage: cy <command> <subcommand> options...');

    this.commands.forEach((object, command) => {
      Logger.log(command);

      const properties = Object.getOwnPropertyNames(object);
      properties.forEach((name) => {
        if (name !== 'constructor' && typeof object[name] === 'function') {
          Logger.log('  ', name);
        }
      });
    });

    process.exit(0);
  }
}
