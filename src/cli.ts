import bodyParser from 'body-parser';
import { existsSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { join } from 'path';
import yargs from 'yargs';
import { Configuration } from './configuration.js';
import { Logger } from './logger.js';

export type CallableCommands = Record<string, Function>;
export type CommandTree = Record<string, CallableCommands>;

export class CommandLineInterface {
  private commands = new Map<string, CallableCommands>();
  protected configuration = new Configuration();

  protected async loadCloudConfiguration(): Promise<void> {
    const filePath = join(process.cwd(), 'cloudy.conf.mjs');

    if (!existsSync(filePath)) {
      Logger.log(`Configuration file at ${filePath} not found`);
      return;
    }

    try {
      const tools = (await import(filePath)).default as CommandTree;

      Object.entries(tools).forEach(([name, commands]) => {
        this.commands.set(name, commands);
      });
    } catch (error) {
      Logger.log(`Invalid cloud configuration file: ${filePath}`);
      Logger.log(error.message);
      throw error;
    }
  }

  async runWithArgs(args: string[]) {
    await this.loadCloudConfiguration();

    if (!args.length || args[0] === '--help') {
      this.showHelpAndExit();
    }

    if (args[0] == '--serve') {
      return this.startServices();
    }

    this.runCommandFromArgs(args);
  }

  private async startServices() {
    Logger.log('Starting services...');
    const server = createServer((request, response) => this.runCommandFromRequest(request, response));
    server.listen(Number(process.env.API_PORT || 80));
  }

  async runCommandFromRequest(request, response) {
    if (request.method !== 'POST' && request.method !== 'GET') {
      response.writeHead(405, 'Invalid request');
      response.end();
      return;
    }

    const [command, functionName] = request.url.slice(1).split('.');
    const target = this.commands.get(command);
    if (!target || !command || !functionName || request.method !== 'POST') {
      response.writeHead(400, 'Bad command, function or options');
      const help = {};
      this.commands.forEach((object, command) => {
        help[command] = [];

        const properties = Object.getOwnPropertyNames(object);
        properties.forEach((name) => {
          if (name !== 'constructor' && typeof object[name] === 'function') {
            help[command].push(name);
          }
        });
      });
      response.write(JSON.stringify(help, null, 2));
      response.end();
      return;
    }

    try {
      const { next, promise } = this.createNext();
      bodyParser.json()(request, response, next);
      await promise;

      const output = await this.runCommand(command, functionName, request.body);
      response.writeHead(200, 'OK');
      response.write(JSON.stringify(output, null, 2));
      response.end();
    } catch (error) {
      response.writeHead(500, 'Oops');
      response.write(error.message);
      Logger.log(error);
      response.end();
    }
  }

  private createNext() {
    const out: any = {};
    out.promise = new Promise((resolve) => (out.resolve = resolve));

    const next = () => out.resolve();
    return { next, promise: out.promise };
  }

  async runCommandFromArgs(args: string[]) {
    const [c, ...params] = args;
    const [command, functionName] = c.split('.');
    const target = this.commands.get(command);
    const optionsFromCli = this.parseParamsFromCli(params);

    if (!target || !functionName || !target[functionName]) {
      Logger.log(`Invalid command: ${command} ${functionName || ''}`);
      this.showHelpAndExit();
    }

    try {
      const output = await this.runCommand(command, functionName, optionsFromCli);
      this.printOutput(output);
      process.exit(0);
    } catch (error) {
      Logger.log(error.message);
      process.exit(1);
    }
  }

  private async runCommand(command, functionName, params) {
    const target = this.commands.get(command);

    const moduleConfig = this.configuration.loadModuleConfiguration(command);
    const optionFromFile = moduleConfig.commands?.commands[functionName] ?? {};
    const mergedOptions = Object.assign({}, params, optionFromFile);

    Logger.debug(`Running command: ${command}.${functionName}`, mergedOptions);
    return await target[functionName](mergedOptions);
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
    Logger.log('Usage: cy <command>.<subcommand> options...');

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
