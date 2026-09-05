import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Configuration, getCloudyConfig } from '../configuration.js';
import { run } from '../index.js';

describe('CLI as a module', () => {
  let server;
  let receivedCalls: any[] = [];

  const config: Configuration = {
    key: 'key',
    default: {} as any,
    apiHost: 'localhost',
    apiPort: 0,
    remoteHost: 'http://localhost',
  };

  beforeEach(async () => {
    receivedCalls = [];
    server = createServer((req, res) => {
      if (req.url === '/command.fail') {
        res.writeHead(400);
        res.end('');
        return;
      }

      const body: any[] = [];
      req.on('data', (c) => body.push(c));
      req.on('end', () => {
        receivedCalls.push([req, Buffer.concat(body).toString('utf8'), res]);
      });
      res.end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
    config.apiPort = (server.address() as AddressInfo).port;
  });

  afterEach(() => {
    if (server.listening) server.close();
  });

  it('should call a remote server', async () => {
    await expect(run('command.name', { foo: true }, config)).resolves.toEqual({});
    expect(receivedCalls.length).toBe(1);
    const [request, body] = receivedCalls[0];
    expect(request.url).toBe('/command.name');
    expect(request.method).toBe('POST');
    expect(request.headers.authorization).toBe('key');
    expect(JSON.parse(body)).toEqual({ foo: true });
  });

  it('should catch errors from server call', async () => {
    await expect(run('command.fail', { foo: true }, config)).rejects.toEqual('400: Bad Request');
  });

  it('should catch connnection errors', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await expect(run('command.fail', {}, config)).rejects.toEqual(
      new Error('Failed to connect to server'),
    );
  });

  it('should read authorization key from a file', async () => {
    process.env.HOME = process.cwd() + '/src/__tests__/withoutKey';
    const settings = await getCloudyConfig();
    settings.apiHost = config.apiHost;
    settings.apiPort = config.apiPort;
    await expect(run('command.keyFromFile', {}, settings)).resolves.toEqual({});
    const [request] = receivedCalls[0];
    expect(request.headers.authorization).toBe('test-key');
  });

  it('should read configuration from a file', async () => {
    process.env.HOME = process.cwd() + '/src/__tests__/withKey';
    const settings = await getCloudyConfig();
    settings.apiHost = config.apiHost;
    settings.apiPort = config.apiPort;
    await expect(run('command.keyFromFile', {}, settings)).resolves.toEqual({});
    const [request] = receivedCalls[0];
    expect(request.headers.authorization).toBe('testKeyFromFile');
  });
});
