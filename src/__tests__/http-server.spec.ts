import { describe, expect, it, vi } from 'vitest';
import { CommandLineInterface } from '../clients/cli.js';
import { HttpServer } from '../http-server.js';
import { init } from '../index.js';
import { Logger } from '../logger.js';
import type { Settings } from '../configuration.js';
import { CloudCommands } from '../cloud-commands.js';
import { randomPort } from './random-port.js';

describe('http server', () => {
  async function setup() {
    const settings: Settings = {
      key: 'key',
      default: {
        [init]: vi.fn(),
        foo: {
          [init]: vi.fn(),
          calledFromTests: vi.fn((args, { run }) => run('foo.calledInternally', args)),
          calledInternally: vi.fn(() => 'I was called internally'),
        },
      },
      apiHost: 'localhost',
      apiPort: await randomPort(),
      remoteHost: 'http://localhost',
    };

    const commands = await CloudCommands.load(settings);

    return { settings, commands };
  }

  it('runs a command on server side', async () => {
    const { settings, commands } = await setup();
    const cli = new CommandLineInterface(settings);
    const server = await new HttpServer(commands, settings).start();
    const output = await cli.run(['foo.calledFromTests', '--foo', 'foo']);
    server.close();

    const serverParams = { run: expect.any(Function) };

    expect(settings.default!.foo.calledFromTests).toHaveBeenCalledWith({ _: [], foo: 'foo' }, serverParams);
    expect(settings.default!.foo.calledInternally).toHaveBeenCalledWith({ _: [], foo: 'foo' }, serverParams);

    expect(output).toBe('I was called internally');
  });

  it('runs the initializer when the server is started', async () => {
    const { settings, commands } = await setup();
    const logger = vi.spyOn(Logger, 'log').mockReturnValue(void 0);
    logger.mockReset();

    const server = await new HttpServer(commands, settings).start();
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('Running initializers for foo');
    expect(Logger.log).toHaveBeenCalledWith('Running initializers for root');
    expect(Logger.log).toHaveBeenCalledWith('Started services at localhost:' + settings.apiPort + '.');

    expect(settings.default![init]).toHaveBeenCalled();
  });
});
