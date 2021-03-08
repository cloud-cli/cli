#!/usr/bin/env node

import { Cloudy } from './cloudy.js';

export const cy = new Cloudy();
const args = process.argv.slice(2);
cy.run(args);
