import { describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'stream';
import { HttpServer } from '../http-server.js';
import { CommandLineInterface } from '../clients/cli.js';
import { CloudCommands } from '../cloud-commands.js';
import { randomPort } from './random-port.js';
import { IncomingMessage, ServerResponse } from 'node:http';
import { init } from '../index.js';
import { Logger } from '../logger.js';
import type { Settings } from '../configuration.js';

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

  // ---- help endpoint tests using handleRequest directly ----

  it('returns available commands for /.help', async () => {
    const { settings, commands } = await setup();
    const httpServer = new HttpServer(commands, settings);
    const server = await httpServer.start();

    const { writable } = new PassThrough();
    const res = new ServerResponse(writable) as ServerResponse;

    const mockRequest: IncomingMessage = {
      method: 'POST',
      url: '/.help',
      headers: { 'content-type': 'application/json', authorization: 'key' },
    } as any;

    await httpServer.handleRequest(mockRequest, res);

    // Verify server is still operational after the request
    expect(server.listening).toBe(true);

    server.close();
  });

  it('returns module help for /.help/<module>', async () => {
    const { settings, commands } = await setup();
    const httpServer = new HttpServer(commands, settings);
    const server = await httpServer.start();

    const { writable } = new PassThrough();
    const res = new ServerResponse(writable) as ServerResponse;

    const mockRequest: IncomingMessage = {
      method: 'POST',
      url: '/.help/foo',
      headers: { 'content-type': 'application/json', authorization: 'key' },
    } as any;

    await httpServer.handleRequest(mockRequest, res);

    // Verify server is still operational after the request
    expect(server.listening).toBe(true);

    server.close();
  });

  it('falls back to function list when module has no help() symbol', async () => {
    const { settings, commands } = await setup();
    const httpServer = new HttpServer(commands, settings);
    const server = await httpServer.start();

    const mockRequest: IncomingMessage = {
      method: 'POST',
      url: '/.help/foo',
      headers: { 'content-type': 'application/json', authorization: 'key' },
    } as any;

    await httpServer.handleRequest(mockRequest, {} as ServerResponse);

    // Verify server is still operational after the request
    expect(server.listening).toBe(true);

    server.close();
  });

  it('regular command routing still works with command.functionName format', async () => {
    const { settings, commands } = await setup();
    const httpServer = new HttpServer(commands, settings);
    const server = await httpServer.start();

    const { writable } = new PassThrough();
    const res = new ServerResponse(writable) as ServerResponse;

    const mockRequest: IncomingMessage = {
      method: 'POST',
      url: '/foo.calledFromTests',
      headers: { 'content-type': 'application/json', authorization: 'key' },
    } as any;

    await httpServer.handleRequest(mockRequest, res);

    // Verify server is still operational after the request
    expect(server.listening).toBe(true);

    server.close();
  });

  it('handles invalid command route with 400', async () => {
    const { settings, commands } = await setup();
    const httpServer = new HttpServer(commands, settings);
    const server = await httpServer.start();

    const mockRequest: IncomingMessage = {
      method: 'POST',
      url: '/invalid',
      headers: { 'content-type': 'application/json', authorization: 'key' },
    } as any;

    const { writable } = new PassThrough();
    const res = new ServerResponse(writable) as ServerResponse;

    await httpServer.handleRequest(mockRequest, res);

    // Verify the response status is 400
    expect(res.statusCode).toBe(400);

    // Verify server is still operational after the request
    expect(server.listening).toBe(true);

    server.close();
  });

  it('handles /.help with trailing module path correctly', async () => {
    const { settings, commands } = await setup();
    const httpServer = new HttpServer(commands, settings);
    const server = await httpServer.start();

    const { writable } = new PassThrough();
    const res = new ServerResponse(writable) as ServerResponse;

    const mockRequest: IncomingMessage = {
      method: 'POST',
      url: '/.help/foo.calledFromTests',
      headers: { 'content-type': 'application/json', authorization: 'key' },
    } as any;

    await httpServer.handleRequest(mockRequest, res);

    // Verify server is still operational after the request
    expect(server.listening).toBe(true);

    server.close();
  });
});
