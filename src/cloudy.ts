import yargs from 'yargs';
import { importRcFile, loadDeclarationFile, readModuleConfiguration } from './configuration.js';
import { Logger } from './logger.js';

type CallableCommands = Record<string, Function>;

export class Cloudy {
  private commands = new Map<string, CallableCommands>();
  private serve: () => void;

  add(name: string, value: CallableCommands) {
    this.commands.set(name, value);
    return this;
  }

  async run(args: string[]) {
    this.serve = await loadDeclarationFile();

    if (args.includes('--help') || args.length === 0) {
      this.showHelpAndExit();
    }

    if (args[0] == '--serve') {
      Logger.log(`Starting services...`);
      return this.serve();
    }

    this.runCommandFromArgs(args);
  }

  async runCommandFromArgs(args: string[]) {
    const [command, functionName, ...params] = args;
    const target = this.commands.get(command);

    if (!target || !target[functionName]) {
      Logger.log(`Invalid command: ${command} ${functionName}`);
      this.showHelpAndExit();
    }

    importRcFile();

    const optionsFromCli = this.readParams(params);
    const optionFromFile = readModuleConfiguration(command, functionName);
    const mergedOptions = Object.assign({}, optionsFromCli, optionFromFile);

    Logger.log(`${command}.${functionName}`, mergedOptions);

    try {
      target[functionName](mergedOptions);
      process.exit(0);
    } catch (error) {
      Logger.log(error.message);
      process.exit(1);
    }
  }

  private readParams(input: string[]) {
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
