#!/usr/bin/env node

import yargs from 'yargs';

const uppercaseLetterRe = /([A-Z])/g;
const dashAndLetterRe = /(-[a-z])/g;

type CallableCommands = Record<string, Function>;
type CommandTree = Map<string, CallableCommands>;

class Cloudy {
  private commands: CommandTree = new Map();

  add(name: string, value: CallableCommands) {
    this.commands.set(name, value);
    return this;
  }

  run() {
    const args = process.argv.slice(2);

    if (args.includes('--help')) {
      this.showHelpAndExit(args);
      return;
    }

    this.execute(args);
  }

  execute(args: string[]): void {
    const [command, subcommand, ...params] = args;
    const target = this.commands[command];
    const functionName = commandToFuctionName(subcommand);
    const options = yargs(params);
    const mergedOptions = Object.assign({}, options);

    if (target[functionName]) {
      console.log(`${command}.${functionName}`, options);
      target[functionName](mergedOptions);
    }
  }

  private showHelpAndExit(_command: string[]): void {
    // const command = args.filter((x) => x !== '--help')[0];
    Object.entries(this.commands).forEach(([command, object]) => {
      console.log(command);

      Object.entries(object).forEach(([name, value]) => {
        if (typeof value === 'function') {
          console.log('\t', functionNameToCommand(name));
        }
      });
    });
  }
}

export const cy = new Cloudy();
setTimeout(() => cy.run());

function functionNameToCommand(name: string) {
  return name.replace(uppercaseLetterRe, '-$1').toLowerCase();
}

function commandToFuctionName(name: string) {
  return name.replace(dashAndLetterRe, (match) => match[1].toUpperCase());
}
