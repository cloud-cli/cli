#!/usr/bin/env node

import { CommandLineInterface } from './clients/cli.js';
import { CloudCommands } from './cloud-commands.js';
import { getCloudyConfig } from './configuration.js';
import { HttpServer } from './http-server.js';

async function serve() {
  try {
    const settings = await getCloudyConfig();
    const commands = await CloudCommands.load(settings);
    const http = new HttpServer(commands, settings);
    return await http.start();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (args[0] == '--serve') {
  await serve();
} else {
  const settings = await getCloudyConfig();
  const cli = new CommandLineInterface(settings);
  cli.run(args);
}
