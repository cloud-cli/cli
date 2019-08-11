import { Shell } from './shell.js';
import { readFile, writeFile, deleteFile, exists } from './io.js';
import { Log } from './log.js';
import { ServiceConfiguration } from './models.js';

const logger = Log.create('nginx');
const replaceVars = (text: string, vars: any) =>
  text.replace(/\{\{\s*(\w+)\s*}\}/g, (_, variable) => vars[variable] || '');

class NginxManager {
  async registerService(service: ServiceConfiguration) {
    const content = await this.createConfigurationForService(service);

    try {
      await writeFile(`nginx/${service.id}.conf`, content);
    } catch (error) {
      logger.error('Failed to create Nginx configuration!');
      logger.debug(error);
    }
  }

  private async createConfigurationForService(service: ServiceConfiguration) {
    const { hostPort, webSocketPort } = service.ports;

    const vars = {
      id: service.name,
      port: hostPort,
      webSocketPort: webSocketPort || '',
      domains: service.domains.join(' '),
    };

    const template = await readFile('server', 'service.conf');
    const templateWithWebSockets = template
      .replace('%webSocket%', this.getWebSocketConfig(service))
      .replace('%secureWebSocket%', this.getWebSocketConfig(service, true));

    return replaceVars(templateWithWebSockets, vars);
  }

  async removeAllSites() {
    try {
      Shell.execSync('rm', ['nginx/*']);
    } catch {}
  }

  async unregisterService(service: ServiceConfiguration) {
    if (await exists('nginx', `${service.id}.conf`)) {
      return await deleteFile('nginx', `${service.id}.conf`);
    }

    return null;
  }

  reload() {
    try {
      Shell.execSync('nginx', ['-t']);
      Shell.execSync('service', ['nginx', 'reload']);
    } catch (error) {
      logger.error('Failed to reload Nginx configuration!');
      logger.debug(error);
    }
  }

  private getWebSocketConfig(service: ServiceConfiguration, isSecure = false) {
    if (!service.webSocket) {
      return '';
    }

    return `
    location /${service.webSocket.path} {
      proxy_set_header Host $http_host;
      ${isSecure ? 'proxy_ssl_server_name on;' : ''}
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
      proxy_pass http://localhost:{{webSocketPort}};
    }
    `;
  }
}

export const Nginx = new NginxManager();
