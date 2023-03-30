import { createServer, IncomingMessage, request, ServerResponse, Server } from 'http';
import { request as httpsRequest } from 'https';
import { CloudConfiguration } from './configuration';
import { Logger } from './logger.js';
import { init } from './constants.js';

export class HttpCommand {
  constructor(private config: CloudConfiguration) { }

  async run(request: IncomingMessage & { body?: any }, response: ServerResponse) {
    if (request.method !== 'POST' && request.method !== 'GET') {
      response.writeHead(405, 'Invalid request');
      response.end();
      return;
    }

    const remoteKey = request.headers.authorization;

    if (this.config.settings.key !== remoteKey) {
      Logger.debug('Invalid key', remoteKey, this.config.settings.key);
      setTimeout(() => {
        response.writeHead(404, 'Not found');
        response.end();
      }, 5000);
      return;
    }

    const [command, functionName] = String(request.url).slice(1).split('.');
    const target = this.config.commands.get(command);

    if (!this.isValidCommand(target, command, functionName) || request.method !== 'POST') {
      response.writeHead(400, 'Bad command, function or options');
      const help = {};

      this.config.commands.forEach((object, command) => {
        if (command === init || !(object && typeof object === 'object')) {
          return;
        }

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
      const payload = await this.parseBody(request);
      const output = await this.runCommand(target, command, functionName, payload);
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

  async serve() {
    const { apiHost, apiPort } = this.config.settings;
    const server = createServer((request, response) => this.run(request, response));

    await this.runInitializers();

    return new Promise<Server>(resolve => {
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
    const initializer = this.config.commands.get(init) as unknown as Function | undefined;

    if (initializer) {
      Logger.log('Running general initializers.');
      initializer();
    }

    const modules = Array.from(this.config.commands.entries());
    for (const [command, object] of modules) {
      if (command !== init && object && typeof object === 'object' && object[init]) {
        Logger.log('Running initializers for ' + String(command));

        try {
          await object[init]();
        } catch (error) {
          Logger.log('FAILED: ' + String(error));
        }
      }
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

  protected async fetchCommands(): Promise<Record<string, string[]>> {
    return new Promise((resolve, reject) => {
      const { apiPort, remoteHost, key } = this.config.settings;
      const url = new URL(`${remoteHost}:${apiPort}/`);
      const headers = { authorization: key };
      const fn = url.protocol === 'https:' ? httpsRequest : request;
      const remote = fn(url, { headers });

      remote.on('response', (response) => {
        const chunks: Buffer[] = [];

        if (response.statusCode !== 200) {
          Logger.debug(`Fetch command returned ${response.statusCode}: ${response.statusMessage}`);
        }

        response.on('error', reject);
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({});
          }
        });
      });

      remote.on('error', reject);
      remote.end();
    });
  }

  protected isValidCommand(target: object | undefined, command: string, functionName: string) {
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
    const optionFromFile = moduleConfig.commands?.[functionName] ?? {};
    const mergedOptions = Object.assign({}, params, optionFromFile);

    Logger.debug(`Running command: ${command}.${functionName}`, mergedOptions);
    return await target[functionName](mergedOptions);
  }
}
