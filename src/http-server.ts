import { readFile } from "node:fs/promises";
import { IncomingMessage, Server, ServerResponse, createServer } from "node:http";
import { validateKey } from "./authorization.js";
import { CloudCommands } from "./cloud-commands.js";
import { Settings, getConfig } from "./configuration.js";
import { events, help } from "./constants.js";
import { Logger } from "./logger.js";

export interface ServerParams {
  run(command: string, args?: any): any;
}

async function getClientJs(request: IncomingMessage) {
  const file = import.meta.resolve("./clients/fetch.mjs").slice(7);
  const source = await readFile(file, "utf-8");
  return source.replace("__API_BASEURL__", "https://" + String(request.headers["x-forwarded-host"]));
}

export class HttpServer {
  constructor(
    private commands: CloudCommands,
    private settings: Settings,
  ) {}

  async handleRequest(request: IncomingMessage & { body?: any }, response: ServerResponse) {
    if (request.method === "GET" && request.url === "/index.mjs") {
      response.writeHead(200, {
        "Content-Type": "text/javascript",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(await getClientJs(request));
      return;
    }

    if (request.method === "GET" && request.url === "/:log-stream") {
      if (!validateKey(request, response, this.settings)) {
        return;
      }

      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "text/event-stream");

      const onLog = (log: string) => {
        response.write("event: log");
        response.write("data: " + log + "\n\n");
      };

      events.on("log", onLog);
      response.on("close", () => events.off("log", onLog));
      response.on("error", () => events.off("log", onLog));
      return;
    }

    if (request.method !== "POST") {
      response.writeHead(405, "Invalid method");
      response.end();
      return;
    }

    if (!validateKey(request, response, this.settings)) {
      return;
    }

    const [command, functionName] = String(request.url).slice(1).split(".");

    if (!command && functionName === "help") {
      this.writeAvailableCommands(response);
      return;
    }

    if (command && functionName === "help") {
      this.writeModuleHelp(response, command);
      return;
    }

    const functionMap = this.commands.map.get(command);
    if (!this.isValidCommand(functionMap, command, functionName)) {
      Logger.debug(`Invalid: ${command}.${functionName}`);
      response.writeHead(400, "Bad command, function or options. Try cy .help for options");
      this.writeAvailableCommands(response);
      return;
    }

    try {
      const payload = await this.parseBody(request);
      const output = await this.runCommand(functionMap, command, functionName, payload);
      const text = JSON.stringify(output || "", null, 2);

      response.writeHead(200, "OK");
      response.end(text);
    } catch (error) {
      Logger.log(error);
      response.writeHead(500, "Oops");
      response.write(error.message || error);
      response.end();
    }
  }

  run(name: string, args: any) {
    const [command, functionName] = name.split(".");
    const target = this.commands.map.get(command);

    if (!this.isValidCommand(target, command, functionName)) {
      throw new Error("Invalid command invoked: " + name);
    }

    return this.runCommand(target, command, functionName, args);
  }

  async start() {
    const { apiHost, apiPort } = this.settings;
    const server = createServer((request, response) => this.handleRequest(request, response));

    await this.commands.initialize();

    return new Promise<Server>((resolve) => {
      server.on("listening", () => resolve(server));
      server.listen(apiPort, apiHost);
      Logger.log(`Started services at ${apiHost}:${apiPort}.`);
    });
  }

  private getAvailableCommands() {
    const help: Record<string, string[]> = {};

    this.commands.map.forEach((object, command) => {
      if (!(object && typeof object === "object")) {
        return;
      }

      const properties = Object.getOwnPropertyNames(object);
      const commands = properties.filter((name) => name !== "constructor" && typeof object[name] === "function");

      if (commands.length) {
        help[command] = commands;
      }
    });

    return help;
  }

  private writeAvailableCommands(response: ServerResponse) {
    const help = this.getAvailableCommands();
    response.end(JSON.stringify(help, null, 2));
  }

  private async writeModuleHelp(response: ServerResponse, command: string) {
    const functionMap = this.commands.map.get(command);
    if (!functionMap || !(typeof functionMap === "object")) {
      response.writeHead(404, "Module not found");
      response.end(JSON.stringify({ error: "Module not found" }));
      return;
    }

    // Check if module exports a help function (via the help Symbol)
    const helpFunc = functionMap[help];
    if (typeof helpFunc === "function") {
      try {
        const helpText = await helpFunc({}, this.serverParams);
        const body = {
          command,
          help: helpText || "No help available for this module.",
        };
        response.end(JSON.stringify(body, null, 2));
        return;
      } catch (error) {
        Logger.log("[error] Help function failed for " + command + ": " + String(error));
      }
    }

    // Fall back to listing available function names
    const properties = Object.getOwnPropertyNames(functionMap);
    const helpText = properties
      .filter((name) => name !== "constructor" && typeof functionMap[name] === "function")
      .map((name) => `  ${name}`)
      .join("\n");

    const body = {
      command,
      help: helpText || "No help available for this module.",
    };
    response.end(JSON.stringify(body, null, 2));
  }

  private parseBody(request: IncomingMessage): Promise<object> {
    return new Promise((resolve, reject) => {
      const chunks = [];
      request.on("data", (c) => chunks.push(c));
      request.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(e);
        }
      });

      request.on("error", reject);
      request.on("close", () => reject(new Error("Request closed")));
    });
  }

  private isValidCommand(functionMap: object | undefined, command: string, functionName: string) {
    return functionMap && command && functionName && typeof functionMap[functionName] === "function";
  }

  private serverParams: ServerParams = {
    run: (commandName: string, args: any) => this.run(commandName, args),
  };

  private async runCommand(functionMap: any, command: string, functionName: string, params: any) {
    const moduleConfig = getConfig(command);
    const optionFromFile = moduleConfig.commands?.[functionName] ?? {};
    const mergedOptions = Object.assign({}, params, optionFromFile);

    Logger.debug(`Running command: ${command}.${functionName}`, mergedOptions);

    return await functionMap[functionName](mergedOptions, this.serverParams);
  }
}
