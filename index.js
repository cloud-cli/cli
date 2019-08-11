#!/usr/bin/env node
import { cli } from './build/cli.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const rcFile = join(process.cwd(), '.cloudyrc');
if (existsSync(rcFile)) {
  Object.assign(process.env, JSON.parse(readFileSync(rcFile)));
}

cli(process.argv.slice(2)).then(console.log, console.error);
