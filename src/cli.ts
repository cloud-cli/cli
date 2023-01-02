import { CloudConfiguration } from './configuration.js';
import { CliCommand } from './cli-command.js';
import { HttpCommand } from './http-command.js';

export class CommandLineInterface {
  private config = new CloudConfiguration();
  private http = new HttpCommand(this.config);
  private cli = new CliCommand(this.config);

  async run(args: string[]) {
    await this.config.loadCloudConfiguration();

    if (!args.length || args[0] === '--help') {
      await this.http.showHelpAndExit();
      return;
    }

    if (args[0] == '--serve') {
      return this.http.serve();
    }

    this.cli.run(args);
  }
}
