#!/usr/bin/env node

import { CommandLineInterface } from './clients/cli.js';
import { CloudConfiguration } from './configuration.js';
import { HttpServer } from './http-server.js';

async function serve() {
  try {
    const config = new CloudConfiguration();
    const http = new HttpServer(config);
    await config.loadCloudConfiguration();
    await config.autoLoadModules();
    await http.serve();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (args[0] == '--serve') {
  serve();
} else {
  const cli = new CommandLineInterface();
  cli.run(args);
}
