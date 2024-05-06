import type { Settings } from './configuration.js';
import { Logger } from './logger.js';

export async function callServer(command: string, args: Record<string, any> = {}, config: Settings) {
  const { apiPort, remoteHost, key } = config;
  const url = new URL(`${remoteHost}:${apiPort}/${command}`);

  const headers = {
    'content-type': 'application/json',
    authorization: key,
  };

  try {
    const request = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });

    if (!request.ok) {
      return Promise.reject(`${request.status}: ${request.statusText}`);
    }

    return request.json();
  } catch (error) {
    Logger.log('Failed to connect to server');
    Logger.debug(error);
    return Promise.reject(new Error('Failed to connect to server'));
  }
}
