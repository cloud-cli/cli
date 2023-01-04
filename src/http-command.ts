import bodyParser from 'body-parser';
import { createServer, IncomingMessage, request, ServerResponse } from 'http';
import { CloudConfiguration } from './configuration';
import { Logger } from './logger.js';

export class HttpCommand {
  constructor(private config: CloudConfiguration) {}

  async run(request: IncomingMessage & { body?: any }, response: ServerResponse) {
    if (request.method !== 'POST' && request.method !== 'GET') {
      response.writeHead(405, 'Invalid request');
      response.end();
      return;
    }

    const remoteKey = request.headers.authorization;

    if (this.config.key !== remoteKey) {
      Logger.debug('Invalid key', remoteKey, this.config.key);
      setTimeout(() => {
        response.writeHead(404, 'Not found');
        response.end();
      }, 5000);
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
      Logger.log(error);
      response.writeHead(500, 'Oops');
      response.write(error.message || error);
    }

    response.end();
  }

  async serve() {
    const { apiHost, apiPort } = this.config.settings;
    const server = createServer((request, response) => this.run(request, response));

    server.listen(apiPort, apiHost);
    Logger.log(`Started services at ${apiHost}:${apiPort}.`);
  }

  async showHelpAndExit() {
    const commands = await this.fetchCommands();

    if (!commands) {
      Logger.log('No commands available.');
      process.exit(1);
    }

    Logger.log('Usage: cy <command>.<subcommand> --option=value');
    const entries = Object.entries(commands);

    entries.forEach((entry) => {
      const [command, subcommands] = entry;
      Logger.log(command);
      subcommands.forEach((name) => Logger.log('  ', name));
    });

    Logger.log(`Example:\n\n\t${entries[0][0]}.${entries[0][1][0]} --foo "foo"`);

    process.exit(0);
  }

  protected async fetchCommands(): Promise<Record<string, string[]>> {
    return new Promise((resolve, reject) => {
      const { apiPort, remoteHost } = this.config.settings;
      const remote = request(`http://${remoteHost}:${apiPort}/`, {
        headers: { authorization: this.config.key },
      });

      remote.on('response', (response) => {
        const chunks = [];

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
