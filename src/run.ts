#!/usr/bin/env node

import { CommandLineInterface } from './cli.js';

const cli = new CommandLineInterface();
const args = process.argv.slice(2);
cli.run(args);
