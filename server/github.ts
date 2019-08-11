import { Http } from './http.js';
import { Log } from './log.js';
import { PublicServiceConfiguration, Service } from './models.js';

const logger = Log.create('github');

interface IncomingWebhook {
  ref?: string;
  repository: {
    full_name: string;
    private: boolean;
  };
}

const defaultConfiguration: PublicServiceConfiguration = {};

class GithubService {
  getServiceJsonUrl(repository: string, head: string) {
    return `https://raw.githubusercontent.com/${repository}/${head}/service.json`;
  }

  getRepositoryUrl(repository: string) {
    return `https://github.com/${repository}`;
  }

  getCloneUrl(repository: string) {
    return this.getRepositoryUrl(repository) + '.git';
  }

  getServiceFromWebhook(pushWebHook: IncomingWebhook): Service {
    try {
      const branch = pushWebHook.ref ? pushWebHook.ref.replace(/^refs\/.+\//, '') : 'master';
      const repository = pushWebHook.repository.full_name;

      if (pushWebHook.repository.private) {
        throw new Error('Private repositories not allowed');
      }

      return { repository, branch };
    } catch (error) {
      logger.debug(pushWebHook);
      logger.error(error);
      throw error;
    }
  }

  async exists(repository: string): Promise<boolean> {
    const requestOptions = { method: 'HEAD' };
    const response = await Http.fetch(this.getRepositoryUrl(repository), requestOptions);

    return response.ok;
  }

  async fetchServiceConfiguration(service: Service): Promise<PublicServiceConfiguration> {
    const { repository, branch } = service;
    const configurationUrl = this.getServiceJsonUrl(repository, branch);
    const headers = {
      'user-agent': 'homebots/cloudy',
      pragma: 'no-cache',
      'cache-control': 'no-cache',
    };

    const requestOptions = {
      auth: process.env.CLOUDY_GITHUB_HTTP_AUTH,
      headers,
    };

    try {
      const configJson = await Http.fetch(configurationUrl, requestOptions);
      const config = JSON.parse(configJson.body.toString('utf8'));
      logger.log(`Configuration found at ${configurationUrl}`, config);

      return config;
    } catch (error) {
      logger.log(`No service configuration found at ${configurationUrl}`);
      return defaultConfiguration;
    }
  }
}

export const GitHub = new GithubService();
