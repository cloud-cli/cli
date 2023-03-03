import { readFileSync } from 'fs';
import { ClientRequest, request } from 'http';
import { request as httpsRequest } from 'https';
import yargs from 'yargs';
import { CloudConfiguration } from './configuration.js';
import { Logger } from './logger.js';

export class CliCommand {
  constructor(private config: CloudConfiguration) { }

  async run(args: string[]) {
    const [command, ...params] = args;
    const json = this.parseParamsFromCli(params);
    const { apiPort, remoteHost } = this.config.settings;
    const url = new URL(`${remoteHost}:${apiPort}/${command}`);
    const fn = url.protocol === 'https:' ? httpsRequest : request;
    const headers = { 'content-type': 'application/json', authorization: this.config.key };
    let remote: ClientRequest;

    try {
      remote = fn(url, {
        method: 'POST',
        headers,
      });
    } catch (error) {
      Logger.log('Failed to connect to server');
      Logger.debug(error.message);
      return;
    }

    remote.on('response', (response) => {
      const chunks: Buffer[] = [];

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
