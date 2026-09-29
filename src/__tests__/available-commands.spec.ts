import { describe, expect, it, vi } from 'vitest';
import { CommandLineInterface } from '../clients/cli.js';
import { Settings } from '../configuration.js';
import { HttpServer } from '../http-server.js';
import { init, help } from '../constants.js';
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

describe('CLI help fetch behavior', () => {
  async function setupHelpTests(): Promise<{
    settings: Settings;
    commands: ReturnType<typeof CloudCommands.load>;
    cli: CommandLineInterface;
    server: import('node:http').Server;
  }> {
    const settings: Settings = {
      key: 'key',
      default: {
        foo: {
          calledFromTests: vi.fn((args, { run }) => run('foo.calledInternally', args)),
          calledInternally: vi.fn(() => 'I was called internally'),
          [help]: vi.fn().mockResolvedValue('Help text for foo module.'),
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

    return { settings, commands, cli, server };
  }

  it('displays help string when cy <module> --help is used', async () => {
    const { settings, commands, cli, server } = await setupHelpTests();

    const output = await cli.fetchModuleHelp('foo');
    expect(output).toBe('Help text for foo module.');

    server.close();
  });

  it('returns undefined when module help is not found', async () => {
    const { settings, commands, cli, server } = await setupHelpTests();

    // Test with a module that has no help function
    const output = await cli.fetchModuleHelp('nonexistent');
    expect(output).toBeUndefined();

    server.close();
  });

  it('handles malformed JSON response gracefully', async () => {
    const { settings, commands, cli, server } = await setupHelpTests();

    // Mock the fetch to return malformed JSON
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => {
        throw new Error('Invalid JSON');
      },
    } as Response);

    const output = await cli.fetchModuleHelp('foo');
    expect(output).toBeUndefined();

    globalThis.fetch = originalFetch;
    server.close();
  });

  it('handles non-OK response gracefully', async () => {
    const { settings, commands, cli, server } = await setupHelpTests();

    // Mock the fetch to return a 404
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    const output = await cli.fetchModuleHelp('nonexistent-module');
    expect(output).toBeUndefined();

    globalThis.fetch = originalFetch;
    server.close();
  });

  it('falls back to function list when module has no help() symbol', async () => {
    const settings: Settings = {
      key: 'key',
      default: {
        foo: {
          [init]() {},
          one() {},
          two() {},
          // no help symbol
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

    // When no help symbol, should get function list as help text
    const output = await cli.fetchModuleHelp('foo');
    // The help text should be the function list fallback
    expect(typeof output).toBe('string');
    expect(output).toContain('one');
    expect(output).toContain('two');

    server.close();
  });
});
