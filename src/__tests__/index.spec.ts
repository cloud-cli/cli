import { init, callServer } from '../index.js';
import { createServer } from 'http';
import { Configuration } from '../configuration.js';

describe('init symbol', () => {
  it('should export a symbol for cloud initializers', () => {
    expect(init).toBeDefined();
  });
});

describe('CLI as a module', () => {
  it('should call a remote server', async () => {
    const serverCalls = [];
    const port = 5000 + ~~(Math.random() * 3000);
    const server = createServer((req, res) => {
      const body = [];
      req.on('data', c => body.push(c));
      req.on('end', () => {
        serverCalls.push([req, Buffer.concat(body).toString('utf8'), res])
      });
      res.end('');
    });

    const config: Configuration = {
      key: 'key',
      default: {} as any,
      apiHost: 'localhost',
      apiPort: port,
      remoteHost: 'http://localhost',
    };

    server.listen(port)
    await callServer('command.name', { foo: true }, config);

    server.close();
    expect(serverCalls.length).toBe(1);

    const [request, body] = serverCalls[0];
    expect(request.url).toBe('/command.name');
    expect(request.method).toBe('POST');
    expect(JSON.parse(body)).toEqual({ foo: true });
  });
})