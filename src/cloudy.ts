import yargs from 'yargs';
import { CloudConfiguration, loadCloudConfigurationFile, readModuleConfiguration } from './configuration.js';
import { Logger } from './logger.js';

type CallableCommands = Record<string, Function>;

export class Cloudy {
  private commands = new Map<string, CallableCommands>();
  private declarationModuleMain: (configuration: CloudConfiguration) => void;

  add(name: string, value: CallableCommands) {
    this.commands.set(name, value);
    return this;
  }

  async run(args: string[]) {
    this.declarationModuleMain = await loadCloudConfigurationFile();

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
    const configuration: CloudConfiguration = {};

    this.commands.forEach((_, name) => (configuration[name] = readModuleConfiguration(name)));
    this.declarationModuleMain(configuration);
  }

  async runCommandFromArgs(args: string[]) {
    const [command, functionName, ...params] = args;
    const target = this.commands.get(command);

    if (!target || !target[functionName]) {
      Logger.log(`Invalid command: ${command} ${functionName}`);
      this.showHelpAndExit();
    }

    const moduleConfig = readModuleConfiguration(command);
    const optionsFromCli = this.parseParamsFromCli(params);
    const optionFromFile = (moduleConfig.commands && moduleConfig.commands[functionName]) || {};
    const mergedOptions = Object.assign({}, optionsFromCli, optionFromFile);

    try {
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

    return params;
  }

  private showHelpAndExit(): void {
    if (!this.commands.size) {
      Logger.log('No commands were declared.');
      process.exit(1);
    }

    Logger.log('Usage: <command> <subcommand> options...');

    this.commands.forEach((object, command) => {
      Logger.log(command);

      const properties = Object.getOwnPropertyNames(Object.getPrototypeOf(object));
      properties.forEach((name) => {
        if (name !== 'constructor' && typeof object[name] === 'function') {
          Logger.log('  ', name);
        }
      });
    });

    process.exit(0);
  }
}
