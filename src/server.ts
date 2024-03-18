import { readFile } from 'node:fs/promises';
import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { CloudConfiguration } from './configuration.js';
import { Logger } from './logger.js';
import { init } from './constants.js';

export interface ServerParams {
  run(command: string, args?: any): any;
}

async function getClientJs(request: IncomingMessage) {
  const file = import.meta.resolve('./client.mjs').slice(7);
  const source = await readFile(file, 'utf-8');
  return source.replace('__API_BASEURL__', 'https://' + String(request.headers['x-forwarded-for']));
}

export class HttpServer {
  constructor(private config: CloudConfiguration) {}

  async run(request: IncomingMessage & { body?: any }, response: ServerResponse) {
    if (request.method === 'GET' && request.url === '/index.mjs' ) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(await getClientJs(request));
      return;
    }

    if (request.method !== 'POST') {
      response.writeHead(405, 'Invalid method');
      response.end();
      return;
    }

    const remoteKey = String(request.headers.authorization.toLowerCase()).replace('Bearer', '').trim();

    if (this.config.settings.key !== remoteKey) {
      Logger.debug('Invalid key', remoteKey, this.config.settings.key);
      setTimeout(() => {
        response.writeHead(404, 'Not found');
        response.end();
      }, 5000);
      return;
    }

    const [command, functionName] = String(request.url).slice(1).split('.');
    if (!command && functionName === 'help') {
      this.writeAvailableCommands(response);
      return;
    }

    const functionMap = this.config.commands.get(command);
    if (!this.isValidCommand(functionMap, command, functionName)) {
      response.writeHead(400, 'Bad command, function or options. Try cy .help for options');
      this.writeAvailableCommands(response);
      return;
    }

    try {
      const payload = await this.parseBody(request);
      const output = await this.runCommand(functionMap, command, functionName, payload);
      const text = JSON.stringify(output || '', null, 2);

      response.writeHead(200, 'OK');
      response.end(text);
    } catch (error) {
      Logger.log(error);
      response.writeHead(500, 'Oops');
      response.write(error.message || error);
      response.end();
    }
  }

  protected runInternal(name: string, args: any) {
    const [command, functionName] = name.split('.');
    const target = this.config.commands.get(command);

    if (!this.isValidCommand(target, command, functionName)) {
      throw new Error('Invalid command invoked: ' + name);
    }

    return this.runCommand(target, command, functionName, args);
  }

  private getAvailableCommands() {
    const help: Record<string, string[]> = {};

    this.config.commands.forEach((object, command) => {
      if (command === init || !(object && typeof object === 'object')) {
        return;
      }

      help[command] = [];

      const properties = Object.getOwnPropertyNames(object);
      const commands = properties.filter((name) => (name !== 'constructor' && typeof object[name] === 'function'));

      if (commands.length) {
        help[command] = commands;
      }
    });

    return help;
  }

  private writeAvailableCommands(response: ServerResponse) {
    const help = this.getAvailableCommands();
    response.end(JSON.stringify(help, null, 2));
  }

  async serve() {
    const { apiHost, apiPort } = this.config.settings;
    const server = createServer((request, response) => this.run(request, response));

    await this.runInitializers();

    return new Promise<Server>((resolve) => {
      server.on('listening', () => resolve(server));
      server.listen(apiPort, apiHost);
      Logger.log(`Started services at ${apiHost}:${apiPort}.`);
    });
  }

  private parseBody(request: IncomingMessage): Promise<object> {
    return new Promise((resolve, reject) => {
      const chunks = [];
      request.on('data', (c) => chunks.push(c));
      request.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(e);
        }
      });

      request.on('error', reject);
      request.on('close', () => reject(new Error('Request closed')));
    });
  }

  private async runInitializers() {
    const modules = Array.from(this.config.commands.entries());
    for (const [command, object] of modules) {
      if (command !== init && object && typeof object === 'object' && object[init]) {
        Logger.log('Running initializers for ' + command);
        const config = await this.config.loadModuleConfiguration(command);

        try {
          await object[init](config);
        } catch (error) {
          Logger.log('FAILED: ' + String(error));
        }
      }
    }

    const initializer = this.config.commands.get(init) as unknown as Function | undefined;
    if (initializer) {
      Logger.log('Running server initializer');
      initializer(this.serverParams);
    }
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

  protected async fetchCommands() {
    const { apiPort, remoteHost, key } = this.config.settings;
    const url = new URL(`${remoteHost}:${apiPort}/`);
    const headers = { authorization: key };
    const remote = await fetch(url, { method: 'POST', headers });

    if (!remote.ok) {
      Logger.debug(`Fetch command returned ${remote.status}: ${remote.statusText}`);
    }

    return (await remote.json()) as Record<string, string[]>;
  }

  protected isValidCommand(functionMap: object | undefined, command: string, functionName: string) {
    return functionMap && command && functionName && typeof functionMap[functionName] === 'function';
  }

  protected createNext() {
    const out: any = {};
    out.promise = new Promise((resolve) => (out.resolve = resolve));

    const next = () => out.resolve();
    return { next, promise: out.promise };
  }

  protected serverParams: ServerParams = {
    run: (commandName: string, args: any) => this.runInternal(commandName, args),
  };

  protected async runCommand(functionMap: any, command: string, functionName: string, params: any) {
    const moduleConfig = await this.config.loadModuleConfiguration(command);
    const optionFromFile = moduleConfig.commands?.[functionName] ?? {};
    const mergedOptions = Object.assign({}, params, optionFromFile);

    Logger.debug(`Running command: ${command}.${functionName}`, mergedOptions);

    return await functionMap[functionName](mergedOptions, this.serverParams);
  }
}
