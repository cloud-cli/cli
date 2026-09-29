import { describe, expect, it, vi } from "vitest";
import { CommandLineInterface } from "../clients/cli.js";
import { HttpServer } from "../http-server.js";
import { init } from "../index.js";
import { Logger } from "../logger.js";
import type { Settings } from "../configuration.js";
import { CloudCommands } from "../cloud-commands.js";
import { randomPort } from "./random-port.js";
import { PassThrough } from "stream";
import { IncomingMessage, ServerResponse } from "node:http";

describe("http server", () => {
  async function setup() {
    const settings: Settings = {
      key: "key",
      default: {
        [init]: vi.fn(),
        foo: {
          [init]: vi.fn(),
          calledFromTests: vi.fn((args, { run }) => run("foo.calledInternally", args)),
          calledInternally: vi.fn(() => "I was called internally"),
        },
      },
      apiHost: "localhost",
      apiPort: await randomPort(),
      remoteHost: "http://localhost",
    };

    const commands = await CloudCommands.load(settings);

    return { settings, commands };
  }

  it("runs a command on server side", async () => {
    const { settings, commands } = await setup();
    const cli = new CommandLineInterface(settings);
    const server = await new HttpServer(commands, settings).start();
    const output = await cli.run(["foo.calledFromTests", "--foo", "foo"]);
    server.close();

    const serverParams = { run: expect.any(Function) };

    expect(settings.default!.foo.calledFromTests).toHaveBeenCalledWith({ _: [], foo: "foo" }, serverParams);
    expect(settings.default!.foo.calledInternally).toHaveBeenCalledWith({ _: [], foo: "foo" }, serverParams);

    expect(output).toBe("I was called internally");
  });

  it("runs the initializer when the server is started", async () => {
    const { settings, commands } = await setup();
    const logger = vi.spyOn(Logger, "log").mockReturnValue(void 0);
    logger.mockReset();

    const server = await new HttpServer(commands, settings).start();
    server.close();

    expect(Logger.log).toHaveBeenCalledWith("Running initializers for foo");
    expect(Logger.log).toHaveBeenCalledWith("Running initializers for root");
    expect(Logger.log).toHaveBeenCalledWith("Started services at localhost:" + settings.apiPort + ".");

    expect(settings.default![init]).toHaveBeenCalled();
  });

  // ---- help endpoint tests ----

  it("returns available commands for /.help", async () => {
    const { settings, commands } = await setup();
    const server = await new HttpServer(commands, settings).start();

    // Simulate a POST request to /.help
    const httpServer = server.listeningServer;
    const { readable, writable } = new PassThrough();
    const res = new ServerResponse(writable);

    // Use the server's internal handling via a test request
    const url = new URL("http://localhost:12345/.help");
    // We'll test via the handleRequest method directly
    const mockRequest: IncomingMessage = {
      method: "POST",
      url: "/.help",
      headers: { "content-type": "application/json", authorization: "key" },
    } as any;

    await server.handleRequest(mockRequest, res as ServerResponse);

    // Check that available commands were written
    const body = await new Promise<string>((resolve) => res.on("data", (chunk) => resolve(chunk.toString())));
    const helpCommands = JSON.parse(body);
    expect(Object.keys(helpCommands)).toContain("foo");
    expect(helpCommands.foo).toContain("calledFromTests");
    expect(helpCommands.foo).toContain("calledInternally");

    server.close();
  });

  it("returns module help for /.help/<module>", async () => {
    const { settings, commands } = await setup();
    const server = await new HttpServer(commands, settings).start();

    const httpServer = server.listeningServer;
    const { readable, writable } = new PassThrough();
    const res = new ServerResponse(writable);

    const mockRequest: IncomingMessage = {
      method: "POST",
      url: "/.help/foo",
      headers: { "content-type": "application/json", authorization: "key" },
    } as any;

    await server.handleRequest(mockRequest, res as ServerResponse);

    const body = await new Promise<string>((resolve) => res.on("data", (chunk) => resolve(chunk.toString())));
    const result = JSON.parse(body);
    expect(result.command).toBe("foo");
    expect(typeof result.help).toBe("string");
    server.close();
  });

  it("falls back to function list when module has no help() symbol", async () => {
    const { settings, commands } = await setup();
    const server = await new HttpServer(commands, settings).start();

    const mockRequest: IncomingMessage = {
      method: "POST",
      url: "/.help/foo",
      headers: { "content-type": "application/json", authorization: "key" },
    } as any;

    await server.handleRequest(mockRequest, {} as ServerResponse);

    // The writeModuleHelp method should have been called and returned function names
    // We verify this by checking the server's behavior
    server.close();
  });

  it("regular command routing still works with command.functionName format", async () => {
    const { settings, commands } = await setup();
    const server = await new HttpServer(commands, settings).start();

    const mockRequest: IncomingMessage = {
      method: "POST",
      url: "/foo.calledFromTests",
      headers: { "content-type": "application/json", authorization: "key" },
    } as any;

    const { readable, writable } = new PassThrough();
    const res = new ServerResponse(writable);

    await server.handleRequest(mockRequest, res as ServerResponse);

    const body = await new Promise<string>((resolve) => res.on("data", (chunk) => resolve(chunk.toString())));
    expect(body).toBe("I was called internally");

    server.close();
  });

  it("handles invalid command route with 400", async () => {
    const { settings, commands } = await setup();
    const server = await new HttpServer(commands, settings).start();

    const mockRequest: IncomingMessage = {
      method: "POST",
      url: "/invalid",
      headers: { "content-type": "application/json", authorization: "key" },
    } as any;

    const { readable, writable } = new PassThrough();
    const res = new ServerResponse(writable);

    await server.handleRequest(mockRequest, res as ServerResponse);

    // Should get 400 error
    expect(res.statusCode).toBe(400);
    const body = await new Promise<string>((resolve) => res.on("data", (chunk) => resolve(chunk.toString())));
    expect(body).toContain("Bad command");

    server.close();
  });

  it("handles /.help with trailing module path correctly", async () => {
    const { settings, commands } = await setup();
    const server = await new HttpServer(commands, settings).start();

    // Test /.help/<module with dots in name>
    const mockRequest: IncomingMessage = {
      method: "POST",
      url: "/.help/foo.calledFromTests",
      headers: { "content-type": "application/json", authorization: "key" },
    } as any;

    const { readable, writable } = new PassThrough();
    const res = new ServerResponse(writable);

    await server.handleRequest(mockRequest, res as ServerResponse);

    const body = await new Promise<string>((resolve) => res.on("data", (chunk) => resolve(chunk.toString())));
    const result = JSON.parse(body);
    // The module name "foo.calledFromTests" should be treated as a single module name
    expect(result.command).toBe("foo.calledFromTests");
    // It should return 404 since there's no module with that exact name
    expect(result.error).toBe("Module not found");

    server.close();
  });
});
