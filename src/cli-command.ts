import { readFileSync } from 'fs';
import { ClientRequest, request } from 'http';
import { request as httpsRequest } from 'https';
import yargs from 'yargs';
import { CloudConfiguration, Configuration } from './configuration.js';
import { Logger } from './logger.js';

export class CliCommand {
  constructor(private config: CloudConfiguration) { }

  async run(args: string[]) {
    const [command, ...params] = args;
    const jsonArgs = this.parseParamsFromCli(params);

    return this.callServer(command, jsonArgs, this.config.settings);
  }

  async callServer(command: string, args: Record<string, any>, config: Configuration) {
    const { apiPort, remoteHost, key } = config;
    const url = new URL(`${remoteHost}:${apiPort}/${command}`);
    const fn = url.protocol === 'https:' ? httpsRequest : request;
    const headers = {
      'content-type': 'application/json',
      authorization: key
    };

    let remote: ClientRequest;

    try {
      remote = fn(url, {
        method: 'POST',
        headers,
      });
    } catch (error) {
      Logger.log('Failed to connect to server');
      Logger.debug(error.message);

      return Promise.reject(error);
    }

    return new Promise((resolve, reject) => {
      remote.on('response', (response) => {
        const chunks: Buffer[] = [];

        if (response.statusCode !== 200) {
          Logger.log(`${response.statusCode}: ${response.statusMessage}\n\n`);
        }

        response.on('error', reject);
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            resolve(body);
          }
        });
      });

      remote.on('error', reject);
      remote.write(JSON.stringify(args));
      remote.end();
    });
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
