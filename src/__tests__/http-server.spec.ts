import { describe, expect, it, vi } from 'vitest';
import { CommandLineInterface } from '../clients/cli.js';
import { CloudConfiguration, Configuration } from '../configuration.js';
import { HttpServer } from '../http-server.js';
import { init } from '../index.js';
import { Logger } from '../logger.js';

describe('http server', () => {
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
    const server = await new HttpServer(config).serve();
    const output = await cli.run(['foo.calledFromTests', '--foo', 'foo']);
    server.close();

    const serverParams = { run: expect.any(Function) };

    expect(settings.default.foo.calledFromTests).toHaveBeenCalledWith({ _: [], foo: 'foo' }, serverParams);
    expect(settings.default.foo.calledInternally).toHaveBeenCalledWith({ _: [], foo: 'foo' }, serverParams);

    expect(output).toBe('I was called internally');
  });

  it('runs the initializer when the server is started', async () => {
    const { settings, config } = setup();
    const cli = new CommandLineInterface(config);
    vi.spyOn(Logger, 'log').mockReturnValue(void 0);

    const server = await new HttpServer(config).serve();
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('Running initializers for foo');
    expect(Logger.log).toHaveBeenCalledWith('Running server initializer');
    expect(Logger.log).toHaveBeenCalledWith('Started services at localhost:' + settings.apiPort + '.');

    expect(settings.default[init]).toHaveBeenCalled();
  });
});
