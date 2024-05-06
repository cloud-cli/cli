import { init } from './constants.js';

export type WithAdditionalOptions<T> = T & { _: string[]; };

export type CallableCommands = {
  [init]?: Function;
  [k: string]: Function;
};

export type CommandTree = {
  [init]?: Function;
  [k: string]: CallableCommands;
};

export type CommandsMap = Map<string, CallableCommands>;