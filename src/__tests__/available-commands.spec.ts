import { describe, expect, it, vi } from 'vitest';
import { CommandLineInterface } from '../clients/cli.js';
import { CloudConfiguration, Configuration } from '../configuration.js';
import { HttpServer } from '../http-server.js';
import { init } from '../index.js';
import { Logger } from '../logger.js';

describe('list available commands', () => {
  let port = 1234;
  it('runs print a help text and exit when "--help" is given as the only argument', async () => {
    const settings: Configuration = {
      key: 'key',
      default: {
        [init]() {},
        foo: {
          [init]() {},
          one() {},
          two() {},
        },
      } ,
      apiHost: 'localhost',
      apiPort: port++,
      remoteHost: 'http://localhost',
    };

    const config = new CloudConfiguration();
    config.settings = settings;
    config.importCommands(settings.default);
    vi.spyOn(config, 'loadCloudConfiguration').mockImplementation(async () => {});

    vi.spyOn(Logger, 'log').mockReturnValue(void 0);
    vi.spyOn(process, 'exit').mockReturnValue(0 as never);

    const cli = new CommandLineInterface(config);
    const server = await new HttpServer(config).serve();
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
    const server = await new HttpServer(config).serve();
    await cli.run(['--help']);
    server.close();

    expect(Logger.log).toHaveBeenCalledWith('No commands available.');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});