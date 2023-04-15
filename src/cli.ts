import { CloudConfiguration } from './configuration.js';
import { CliCommand } from './cli-command.js';
import { HttpServer } from './server.js';

export class CommandLineInterface {
  protected http: HttpServer;
  protected cli: CliCommand;

  constructor(
    protected config = new CloudConfiguration(),
  ) {
    this.http = new HttpServer(config);
    this.cli = new CliCommand(config);
  }

  async run(args: string[]) {
    await this.config.loadCloudConfiguration();

    if (!args.length || args[0] === '--help') {
      await this.http.showHelpAndExit();
      return;
    }

    if (args[0] === '--serve') {
      await this.config.autoLoadModules();
      return this.http.serve();
    }

    try {
      const output = await this.cli.run(args);
      this.printOutput(output);
    } catch (error) {
      console.error(error);
    }
  }

  printOutput(output: any) {
    if (output === undefined) return;

    if (typeof output === 'object' && output) {
      output = JSON.stringify(output, null, 2);
    }

    console.log(output);
  }
}
