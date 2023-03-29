import { events, init, run } from '../index.js';
import { createServer } from 'http';
import { CloudConfiguration, Configuration } from '../configuration.js';
import { CommandLineInterface } from '../cli.js';
import { Logger } from '../logger.js';

describe('init symbol', () => {
  it('should export a symbol for cloud initializers', () => {
    expect(init).toBeDefined();
  });
});

describe('CLI as a module', () => {
  it('should call a remote server', async () => {
    const serverCalls = [];
    const port = 3000;
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

    server.listen(port);
    await run('command.name', { foo: true }, config);

    server.close();
    expect(serverCalls.length).toBe(1);

    const [request, body] = serverCalls[0];
    expect(request.url).toBe('/command.name');
    expect(request.method).toBe('POST');
    expect(JSON.parse(body)).toEqual({ foo: true });
  });
});

describe('run initializers for a module', () => {
  let port = 3001;
  function setup() {
    const settings: Configuration = {
      key: 'key',
      default: {
        [init]: jest.fn(),
        foo: {
          [init]: jest.fn(),
          tests() { },
        }
      } as any,
      apiHost: 'localhost',
      apiPort: port++,
      remoteHost: 'http://localhost',
    };

    const config = new CloudConfiguration();
    config.settings = settings;
    config.importCommands(settings.default);
    jest.spyOn(config, 'loadCloudConfiguration').mockImplementation(async () => { });

    return { settings, config };
  }

  it('runs the initializer when the server is started', async () => {
    const { settings, config } = setup();
    const cli = new CommandLineInterface(config);
    jest.spyOn(Logger, 'log').mockReturnValue(void 0);

    const server = await cli.run(['--serve']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('Started services at localhost:' + settings.apiPort + '.');
    expect(Logger.log).toHaveBeenCalledWith('Running general initializers.');
    expect(Logger.log).toHaveBeenCalledWith('Running initializers for foo');

    expect(settings.default[init]).toHaveBeenCalled();
  });

  it('runs print a help text and exit when "--help" is given as the only argument', async () => {
    const { settings, config } = setup();

    jest.spyOn(Logger, 'log').mockReturnValue(void 0);
    jest.spyOn(process, 'exit').mockImplementation();

    const cli = new CommandLineInterface(config);
    const server = await cli.run(['--serve']);
    await cli.run(['--help']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('Started services at localhost:' + settings.apiPort + '.');
    expect(Logger.log).toHaveBeenCalledWith('Running general initializers.');
    expect(Logger.log).toHaveBeenCalledWith('Running initializers for foo');

    expect(Logger.log).toHaveBeenCalledWith('Usage: cy <command>.<subcommand> --option=value\nAvailable commands:\n');
    expect(Logger.log).toHaveBeenCalledWith('foo');
    expect(Logger.log).toHaveBeenCalledWith('  ', 'tests');
    expect(Logger.log).toHaveBeenCalledWith('\n\nExample:\n\n\tfoo.tests --foo "foo"');
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

    jest.spyOn(config, 'loadCloudConfiguration').mockImplementation(async () => { });
    jest.spyOn(Logger, 'log').mockReturnValue(void 0);
    jest.spyOn(process, 'exit').mockImplementation();

    const cli = new CommandLineInterface(config);
    const server = await cli.run(['--serve']);
    await cli.run(['--help']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('No commands available.');
    expect(process.exit).toHaveBeenCalledWith(1);
  })
});

describe('events', () => {
  it('should have an event emitter for modules to communicate', () => {
    const spy = jest.fn();
    const foo = { foo: true }
    events.on('test', spy);
    events.emit('test', foo);

    expect(spy).toHaveBeenCalledWith(foo);
  });
})