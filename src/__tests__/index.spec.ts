import { events, init, run } from '../index.js';
import { createServer } from 'http';
import { CloudConfiguration, Configuration } from '../configuration.js';
import { CommandLineInterface } from '../cli.js';
import { Logger } from '../logger.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('init symbol', () => {
  it('should export a symbol for cloud initializers', () => {
    expect(init).toBeDefined();
  });
});

describe('CLI as a module', () => {
  const port = 3000;
  let server;
  let receivedCalls = [];

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

      const body = [];
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

describe('run initializers for a module', () => {
  let port = 3001;

  function setup() {
    const settings: Configuration = {
      key: 'key',
      default: {
        [init]: vi.fn(),
        foo: {
          [init]: vi.fn(),
          calledFromTests: vi.fn((args, { run }) => run('foo.calledInternally', args)),
          calledInternally: vi.fn(() => 'I was called internally'),
        },
      } as any,
      apiHost: 'localhost',
      apiPort: port++,
      remoteHost: 'http://localhost',
    };

    const config = new CloudConfiguration();
    config.settings = settings;
    config.importCommands(settings.default);
    vi.spyOn(config, 'loadCloudConfiguration').mockImplementation(async () => {});

    return { settings, config };
  }

  it('runs a command on server side', async () => {
    const { settings, config } = setup();
    const cli = new CommandLineInterface(config);
    const server: any = await cli.run(['--serve']);
    const output = await cli.run(['foo.calledFromTests', '--foo', 'foo']);
    server.close();

    const serverParams = { run: expect.any(Function) };

    expect(settings.default.foo.calledFromTests).toHaveBeenCalledWith({ foo: 'foo' }, serverParams);
    expect(settings.default.foo.calledInternally).toHaveBeenCalledWith({ foo: 'foo' }, serverParams);

    expect(output).toBe('I was called internally');
  });

  it('runs the initializer when the server is started', async () => {
    const { settings, config } = setup();
    const cli = new CommandLineInterface(config);
    vi.spyOn(Logger, 'log').mockReturnValue(void 0);

    const server: any = await cli.run(['--serve']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('Running initializers for foo');
    expect(Logger.log).toHaveBeenCalledWith('Running server initializer');
    expect(Logger.log).toHaveBeenCalledWith('Started services at localhost:' + settings.apiPort + '.');

    expect(settings.default[init]).toHaveBeenCalled();
  });

  it('runs print a help text and exit when "--help" is given as the only argument', async () => {
    const { settings, config } = setup();

    vi.spyOn(Logger, 'log').mockReturnValue(void 0);
    vi.spyOn(process, 'exit').mockReturnValue(0 as never);

    const cli = new CommandLineInterface(config);
    const server: any = await cli.run(['--serve']);
    await cli.run(['--help']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('Started services at localhost:' + settings.apiPort + '.');
    expect(Logger.log).toHaveBeenCalledWith('Running initializers for foo');
    expect(Logger.log).toHaveBeenCalledWith('Running server initializer');
    expect(Logger.log).toHaveBeenCalledWith('Usage: cy <command>.<subcommand> --option=value\nAvailable commands:\n');
    expect(Logger.log).toHaveBeenCalledWith('foo');
    expect(Logger.log).toHaveBeenCalledWith('  ', 'calledFromTests');
    expect(Logger.log).toHaveBeenCalledWith('  ', 'calledInternally');
    expect(Logger.log).toHaveBeenCalledWith('\n\nExample:\n\n\tfoo.calledFromTests --foo "foo"');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should show a text when no command is available', async () => {
    const config = new CloudConfiguration();
    config.settings = {
      key: 'key',
      default: {} as any,
      apiHost: 'localhost',
      apiPort: 2999,
      remoteHost: 'http://localhost',
    };

    vi.spyOn(config, 'loadCloudConfiguration').mockImplementation(async () => {});
    vi.spyOn(Logger, 'log').mockReturnValue(void 0);
    vi.spyOn(process, 'exit').mockReturnValue(0 as never);

    const cli = new CommandLineInterface(config);
    const server: any = await cli.run(['--serve']);
    await cli.run(['--help']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('No commands available.');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe('events', () => {
  it('should have an event emitter for modules to communicate', () => {
    const spy = vi.fn();
    const foo = { foo: true };
    events.on('test', spy);
    events.emit('test', foo);

    expect(spy).toHaveBeenCalledWith(foo);
  });
});
