import { ChildProcessWithoutNullStreams, spawn, spawnSync, SpawnSyncOptions } from 'child_process';
import { Log } from './log.js';

const shOptions: SpawnSyncOptions = { stdio: 'pipe', shell: true };
const logger = Log.create('shell');
const runningProcesses: ExecAsync[] = [];

process.on('SIGINT', function () {
  console.log('Stopping running containers...');
  runningProcesses.forEach((item) => item.terminate());
  process.exit();
});

export interface ExecAsync {
  child: ChildProcessWithoutNullStreams;
  terminated: boolean;
  terminate: () => boolean;
}

export class Shell {
  static execAndLog(command: string, args: any[]) {
    logger.log(command + ' ' + args.join(' '));

    try {
      const output = Shell.execSync(command, args);

      if (output) {
        logger.log(output);
      }

      return output;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static execSync(command: string, args: readonly string[] = []) {
    const commandOutput = spawnSync(command, args, shOptions);

    if (commandOutput.error || Number(commandOutput.status) !== 0) {
      throw new Error(
        `Command "${command}" failed with code ${commandOutput.status}:\n${commandOutput.stderr.toString()}`,
      );
    }

    return commandOutput.stdout.toString('utf8').trim();
  }

  static exec(command: string, args: string[] = []): ExecAsync {
    const childProcess = spawn(command, args, { detached: true, stdio: [null, 'pipe', 'pipe'] });
    const execOutput: ExecAsync = {
      child: childProcess,
      terminated: false,

      terminate() {
        return childProcess.kill('SIGINT');
      },
    };

    logger.log(command + ' ' + args.join(' '));

    const onExit = (code?: number) => {
      logger.log(`Exit with code ${code}`);
      execOutput.terminated = true;
    };

    const onMessage = (message: string) => logger.log(message);
    const onError = (error: any) => logger.error(error);

    childProcess.addListener('close', onExit);
    childProcess.addListener('exit', onExit);
    childProcess.addListener('message', onMessage);
    childProcess.stdout.on('data', onMessage);
    childProcess.addListener('error', onError);
    childProcess.addListener('', onError);

    runningProcesses.push(execOutput);

    return execOutput;
  }
}
