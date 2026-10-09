import { join } from 'node:path';
import { Settings } from './configuration.js';
import { init } from './constants.js';
import { Logger } from './logger.js';
import type { CallableCommands, CommandTree, CommandsMap } from './types.js';

export class CloudCommands {
  readonly map: CommandsMap = new Map<string, CallableCommands>();
  private initializers: any[] = [];

  constructor(tree: CommandTree) {
    Object.entries(tree).forEach(([name, commands]) => {
      if (commands[init]) {
        this.initializers.push([name, () => commands[init]()]);
      }

      this.map.set(name, commands);
    });

    if (tree[init]) {
      this.initializers.push(['root', () => tree[init]()]);
    }
  }

  async initialize() {
    for (const next of this.initializers) {
      Logger.log('Running initializers for ' + next[0]);

      try {
        await next[1]();
      } catch (error) {
        Logger.log('[error]: ' + String(error));
      }
    }
  }

  static async load(settings?: Settings) {
    const tools = (settings?.default || {}) as CommandTree;
    const pkg = await import(join(process.cwd(), 'package.json'), { with: { type: 'json' } });
    const dependencies = pkg.default.dependencies || {};
    const prefix = '@cloud-cli/';
    const modules = Object.keys(dependencies).filter((k) => k.startsWith(prefix));

    Logger.debug(`Found ${modules.length} modules`);

    for (const name of modules) {
      try {
        const m = await import(name);
        if (m.default && typeof m.default === 'object') {
          Logger.debug('Loaded commands from ' + name);
          tools[name.replace(prefix, '')] = m.default;
        }
      } catch {
        Logger.log('[error] Failed to load ' + name);
      }
    }

    return new CloudCommands(tools);
  }
}
