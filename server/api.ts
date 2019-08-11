import { Get, Post, Http } from './http.js';
import { readFile } from './io.js';
import { Services } from './service.js';
import { KeyManager } from './keys.js';
import { Server } from './server.js';
import { GitHub } from './github.js';
import { Service } from './models.js';
import { pluck } from './utils.js';

export async function api() {
  const httpSecret = await readFile('.key');

  Http.when(Get, '/', (_, response) => response.send('OK'));
  Http.when(Get, '/services', async (_, response) => {
    const services = await Services.getStatus();
    const list = services.map((service) => pluck(service, ['type', 'repository', 'branch', 'online']));

    response.send(JSON.stringify(list));
  });

  Http.when(Post, '/deploy', async (request, response) => {
    const service = GitHub.getServiceFromWebhook(Object(request.body));
    const serviceKey = KeyManager.getServiceKey(service);

    if (!serviceKey || !Http.checkProtectedRoute(request, serviceKey)) {
      response.send(401);
      return;
    }

    response.send(202);
    setTimeout(async () => {
      try {
        await Services.build(service);
        await Services.runInBackground(service);
      } catch (error) {
        console.error('Failed to deploy service', service, error);
      }
    });
  });

  Http.when(Post, '/run', async (request, response) => {
    const { repository, branch } = request.body as Service;
    const service = { repository, branch };
    const serviceKey = KeyManager.getServiceKey(service);

    if (!serviceKey || !Http.checkProtectedRoute(request, serviceKey)) {
      response.send(401);
      return;
    }

    setTimeout(async () => {
      try {
        response.send(202, Services.runAndExit(service));
      } catch (error) {
        console.error('Failed to run', service, error);
        response.send(500);
      }
    });
  });

  Http.when(Post, '/destroy', async (request, response) => {
    const service = request.body as Service;
    const serviceKey = KeyManager.getServiceKey(service);

    if (!serviceKey || !Http.checkProtectedRoute(request, serviceKey)) {
      response.send(401);
      return;
    }

    response.send(Services.build(service));
  });

  Http.when(Post, '/create', async (request, response) => {
    const repository = String(request.body || '').trim();
    const service = { repository, branch: 'master' };

    try {
      const key = KeyManager.createServiceKey(service);
      response.send(201, key);
    } catch (error) {
      response.send(400, error);
    }
  });

  Http.when(Post, '/reload', (request, response) => {
    if (!Http.checkProtectedRoute(request, httpSecret)) {
      response.send(401);
      return;
    }

    response.send('');

    setTimeout(() => {
      Server.updateRepository();
      Server.reloadAfterBuild();
    }, 10);
  });

  Http.listen(Number(process.env.PORT) || 9999, '127.0.0.1');
}
