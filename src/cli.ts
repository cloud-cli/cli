import bodyParser from 'body-parser';
import { existsSync, readFileSync } from 'fs';
import { createServer, request } from 'http';
import { join } from 'path';
import yargs from 'yargs';
import { Logger } from './logger.js';

export interface ModuleConfiguration {
  commands?: {
    [command: string]: object;
  };
}

export interface Configuration {
  default: CommandTree;
  apiPort?: number;
  apiHost?: string;
}

const defaults: Partial<Configuration> = {
  apiPort: 80,
  apiHost: 'localhost',
};

export type CallableCommands = Record<string, Function>;
export type CommandTree = Record<string, CallableCommands>;

class CloudConfiguration {
  commands = new Map<string, CallableCommands>();
  settings: Configuration;

  async loadCloudConfiguration(): Promise<void> {
    const filePath = join(process.cwd(), 'cloudy.conf.mjs');

    if (!existsSync(filePath)) {
      Logger.log(`Configuration file at ${filePath} not found`);
      return;
    }

    try {
      const config = await import(filePath);
      const tools = config.default as CommandTree;

      Object.entries(tools).forEach(([name, commands]) => {
        this.commands.set(name, commands);
      });

      this.settings = { ...defaults, ...config };
    } catch (error) {
      Logger.log(`Invalid cloud configuration file: ${filePath}`);
      Logger.log(error.message);
      throw error;
    }
  }

  loadModuleConfiguration(moduleName: string): ModuleConfiguration {
    const filePath = join(process.cwd(), 'configuration', `${moduleName}.json`);

    if (!existsSync(filePath)) {
      return {};
    }

    try {
      return this.readAndParse(filePath) as ModuleConfiguration;
    } catch (error) {
      Logger.log(`Invalid configuration file for ${moduleName}: ${error.message}`);
      throw error;
    }
  }

  protected readAndParse(filePath: string): object {
    return JSON.parse(String(readFileSync(filePath)));
  }
}

class HttpCommand {
  constructor(private config: CloudConfiguration) {}

  async run(request, response) {
    if (request.method !== 'POST' && request.method !== 'GET') {
      response.writeHead(405, 'Invalid request');
      response.end();
      return;
    }

    const [command, functionName] = request.url.slice(1).split('.');
    const target = this.config.commands.get(command);

    if (!this.isValidCommand(target, command, functionName) || request.method !== 'POST') {
      response.writeHead(400, 'Bad command, function or options');
      const help = {};

      this.config.commands.forEach((object, command) => {
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

      const output = await this.runCommand(target, command, functionName, request.body);
      const text = JSON.stringify(output || '', null, 2);

      response.writeHead(200, 'OK');
      response.write(text);
      response.end();
    } catch (error) {
      response.writeHead(500, 'Oops');
      response.write(error.message || error);
      Logger.log(error);
    }

    response.end();
  }

  async serve() {
    const apiPort = this.config.settings.apiPort;
    Logger.log(`Started services at :${apiPort}.`);
    const server = createServer((request, response) => this.run(request, response));
    server.listen(apiPort);
  }

  protected isValidCommand(target: object, command: string, functionName: string) {
    return target && command && functionName && typeof target[functionName] === 'function';
  }

  protected createNext() {
    const out: any = {};
    out.promise = new Promise((resolve) => (out.resolve = resolve));

    const next = () => out.resolve();
    return { next, promise: out.promise };
  }

  protected async runCommand(target: any, command: string, functionName: string, params: any) {
    const moduleConfig = this.config.loadModuleConfiguration(command);
    const optionFromFile = moduleConfig.commands?.commands[functionName] ?? {};
    const mergedOptions = Object.assign({}, params, optionFromFile);

    Logger.debug(`Running command: ${command}.${functionName}`, mergedOptions);
    return await target[functionName](mergedOptions);
  }
}

class CliCommand {
  constructor(private config: CloudConfiguration) {}

  showHelpAndExit(): void {
    const commands = this.config.commands;

    if (!commands.size) {
      Logger.log('No commands were declared.');
      process.exit(1);
    }

    Logger.log('Usage: cy --serve');
    Logger.log('Usage: cy <command>.<subcommand> options...');

    commands.forEach((object, command) => {
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

  async run(args: string[]) {
    const [command, ...params] = args;
    const json = this.parseParamsFromCli(params);
    const { apiPort, apiHost } = this.config.settings;
    const remote = request(`http://${apiHost}:${apiPort}/${command}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    remote.on('response', (response) => {
      const chunks = [];

      if (response.statusCode !== 200) {
        console.log(`${response.statusCode}: ${response.statusMessage}`);
      }

      response.on('error', (error) => this.printOutput(error));
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');

        try {
          this.printOutput(JSON.parse(body));
        } catch (error) {
          console.log(body);
        }
      });
    });

    remote.on('error', (error) => this.printOutput(error));
    remote.write(JSON.stringify(json));
    remote.end();
  }

  protected printOutput(output: any) {
    if (output === undefined) return;

    if (typeof output === 'object' && output) {
      output = JSON.stringify(output);
    }

    Logger.log(output);
  }

  protected parseParamsFromCli(input: string[]) {
    const { argv } = yargs(input);
    const { _, $0, ...params } = argv;

    this.readFileReferences(params);

    return params;
  }

  protected readFileReferences(params: Record<string, unknown>) {
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'object') {
        return this.readFileReferences(value as any);
      }

      if (String(value).startsWith('@')) {
        params[key] = readFileSync(String(value).slice(1), { encoding: 'utf-8' });
      }
    });
  }
}

export class CommandLineInterface {
  private config = new CloudConfiguration();
  private http = new HttpCommand(this.config);
  private cli = new CliCommand(this.config);

  async run(args: string[]) {
    await this.config.loadCloudConfiguration();

    if (!args.length || args[0] === '--help') {
      this.cli.showHelpAndExit();
    }

    if (args[0] == '--serve') {
      return this.http.serve();
    }

    this.cli.run(args);
  }
}
