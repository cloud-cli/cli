import { describe, expect, it, vi } from 'vitest';
import { CommandLineInterface } from '../clients/cli.js';
import { Settings } from '../configuration.js';
import { HttpServer } from '../http-server.js';
import { init } from '../index.js';
import { Logger } from '../logger.js';
import { CloudCommands } from '../cloud-commands.js';
import { randomPort } from './random-port.js';

describe('list available commands', () => {
  it('runs print a help text and exit when "--help" is given as the only argument', async () => {
    const settings: Settings = {
      key: 'key',
      default: {
        [init]() {},
        foo: {
          [init]() {},
          one() {},
          two() {},
        },
      },
      apiHost: 'localhost',
      apiPort: await randomPort(),
      remoteHost: 'http://localhost',
    };

    const commands = await CloudCommands.load(settings);

    vi.spyOn(Logger, 'log').mockReturnValue(void 0);
    vi.spyOn(process, 'exit').mockReturnValue(0 as never);

    const cli = new CommandLineInterface(settings);
    const server = await new HttpServer(commands, settings).start();
    await cli.run(['--help']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('Usage: cy <command>.<subcommand> --option=value\nAvailable commands:\n');
    expect(Logger.log).toHaveBeenCalledWith('foo');
    expect(Logger.log).toHaveBeenCalledWith('  ', 'one');
    expect(Logger.log).toHaveBeenCalledWith('  ', 'two');
    expect(Logger.log).toHaveBeenCalledWith('\n\nExample:\n\n\tfoo.one --foo "foo"');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should show a text when no command is available', async () => {
    const commands = await CloudCommands.load();
    const settings = {
      key: 'key',
      default: {} as any,
      apiHost: 'localhost',
      apiPort: await randomPort(),
      remoteHost: 'http://localhost',
    };

    vi.spyOn(Logger, 'log').mockReturnValue(void 0);
    vi.spyOn(process, 'exit').mockReturnValue(0 as never);

    const cli = new CommandLineInterface(settings);
    const server = await new HttpServer(commands, settings).start();
    await cli.run(['--help']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('No commands available.');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
