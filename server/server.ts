import { Log } from './log.js';
import { Shell } from './shell.js';
import { Services } from './service.js';
import { mkdirSync, writeFile } from './io.js';
import { randomBytes } from 'crypto';

const logger = Log.create('server');

class ServerManager {
  updateRepository() {
    try {
      Shell.execAndLog('git', ['pull', '--rebase']);
      Shell.execAndLog('npm', ['ci']);
      Shell.execAndLog('npm', ['run', 'build']);
    } catch (error) {
      logger.error(error.message);
    }
  }

  reloadAfterBuild() {
    const exit = () => Services.building || this.reload();
    exit();
    setInterval(exit, 1000);
  }

  reload() {
    Shell.execSync('pm2', ['reload', 'cloudy']);
  }

  createProject() {
    const folders = ['nginx', 'data', 'storage', 'logs'];

    folders.forEach((folder) => mkdirSync(folder));

    const environment = {
      CLOUDY_MAX_MEMORY: '32mb',
      CLOUDY_GITHUB_HTTP_AUTH: '',
      LOG_OUTPUT: 'console',
      CLOUDY_DOMAIN: '',
    };

    const randomKey = randomBytes(128).toString('hex');

    writeFile('.cloudyrc', JSON.stringify(environment, null, 2));
    writeFile('.key', randomKey);

    logger.log('Project created');
  }
}

export const Server = new ServerManager();
