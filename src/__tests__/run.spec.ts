import { createServer } from 'http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Configuration } from '../configuration.js';
import { run } from '../index.js';

describe('CLI as a module', () => {
  const port = 3000;
  let server;
  let receivedCalls: any[] = [];

  const config: Configuration = {
    key: 'key',
    default: {} as any,
    apiHost: 'localhost',
    apiPort: port,
    remoteHost: 'http://localhost',
  };

  beforeEach(() => {
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
    server.listen(port);
  });

  afterEach(() => server.close());

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
    await expect(run('command.fail', {}, { ...config, apiPort: 12345 })).rejects.toEqual(
      new Error('Failed to connect to server'),
    );
  });

  it('should read authorization key from a file', async () => {
    process.env.HOME = process.cwd() + '/src/__tests__/withoutKey';
    await expect(run('command.keyFromFile', {})).resolves.toEqual({});
    const [request] = receivedCalls[0];
    expect(request.headers.authorization).toBe('test-key');
  });

  it('should read configuration from a file', async () => {
    process.env.HOME = process.cwd() + '/src/__tests__/withKey';
    await expect(run('command.keyFromFile', {})).resolves.toEqual({});
    const [request] = receivedCalls[0];
    expect(request.headers.authorization).toBe('testKeyFromFile');
  });
});