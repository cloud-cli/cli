import { readFileSync } from 'node:fs';
import yargs from 'yargs';
import { CloudConfiguration, Configuration } from './configuration.js';
import { Logger } from './logger.js';

export class CliCommand {
  constructor(private config: CloudConfiguration) {}

  async run(args: string[]) {
    const [command, ...params] = args;
    const jsonArgs = this.parseParamsFromCli(params);

    return this.callServer(command, jsonArgs, this.config.settings);
  }

  async callServer(command: string, args: Record<string, any>, config: Configuration) {
    const { apiPort, remoteHost, key } = config;
    const url = new URL(`${remoteHost}:${apiPort}/${command}`);
    const headers = {
      'content-type': 'application/json',
      authorization: key,
    };

    try {
      const request = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(args),
      });

      if (!request.ok) {
        return Promise.reject(`${request.status}: ${request.statusText}`);
      }

      return request.json();
    } catch (error) {
      Logger.log('Failed to connect to server');
      Logger.debug(error);
      return Promise.reject(new Error('Failed to connect to server'));
    }
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

      if (String(value).startsWith('@file:')) {
        params[key] = readFileSync(String(value).slice(6), { encoding: 'utf-8' });
      }
    });
  }
}
