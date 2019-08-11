import { Services } from './service.js';
import { Server } from './server.js';
import { Service } from './models.js';
import { GitHub } from './github.js';
import { KeyManager } from './keys.js';
import { api } from './api.js';

function printHelp() {
  console.log(`
    ## Initialize a new cloudy environment
      cy init

    ## Server management commands:
      cy serve                        Start HTTP server (default port is 9999)
      cy ls
      cy build-all                    Rebuild all services and re-run containers
      cy restart-all                  Redeploy all containers

    ## Service commands:

      cy run repository [branch]      Build, run and discard a project

    ## Repository commands
    Usage: cy <command> repository [branch]

      cy create                       Create a service
      cy build                        Create/build/deploy a service
      cy destroy                      Stop container, destroy image and remove service

      cy create-key                   Create GitHub webhook key for auto-deploy
      cy get-key                      Retrieve service key (if exists)
      cy delete-key                   Delete a deploy key

      cy start                        Start a container from previously build image
      cy stop                         Stop container of a running service
      cy restart                      Stop and start again a service container

  `);
}

export async function cli(args: string[]) {
  const command = args.shift();
  const [repository, branch] = args;
  const service: Service = { repository, branch: branch || 'master' };

  let services;

  switch (command) {
    case 'create':
      await Services.create(service);
      Server.reload();
      break;

    case 'build':
      const configuration = await GitHub.fetchServiceConfiguration(service);
      await Services.create(service, configuration);
      await Services.build(service, configuration);
      await Services.runInBackground(service, configuration);
      Server.reload();
      break;

    case 'run':
      await Services.runAndExit(service);
      break;

    case 'destroy':
      await Services.destroy(service);
      Server.reload();
      break;

    case 'create-key':
      const repositoryExists = await GitHub.exists(repository);
      if (!repositoryExists) {
        throw new Error('Repository not found');
      }

      const key = await KeyManager.createServiceKey(service);
      Server.reload();
      return key;

    case 'get-key':
      return await KeyManager.getServiceKey(service);

    case 'delete-key':
      await KeyManager.deleteServiceKey(service);
      break;

    case 'stop':
      await Services.stop(service);
      break;

    case 'start':
      await Services.runInBackground(service);
      break;

    case 'restart':
      await Services.stop(service);
      await Services.runInBackground(service);
      break;

    case 'restart-all':
      for (const service of Services.getStatus()) {
        await Services.stop(service);
        await Services.runInBackground(service);
      }
      Server.reload();
      break;

    case 'build-all':
      for (const service of Services.getStatus()) {
        await Services.build(service);
        await Services.runInBackground(service);
      }
      Server.reload();
      break;

    case 'ls':
      services = Services.getStatus().map((service) => ({
        id: service.id,
        name: service.name,
        type: service.type,
        online: `${service.online ? '  -  ' : '[ ! ]'}`,
        origin: (service.repository + ' ' + ((service.branch !== 'master' && service.branch) || '')).trim(),
        key: KeyManager.getServiceKey(service),
      }));

      const field = args[0];

      if (field) {
        return services.map((service: any) => service[field]).join('\n');
      }

      const headers = ['---', 'Id', 'Container', 'Type', 'Origin', 'Key'];

      return formatList(
        [headers, Array(headers.length).fill('')].concat(
          services.map((_) => [_.online, _.id, _.name, _.type, _.origin, _.key]),
        ),
      );

    case 'status':
      return JSON.stringify(Services.getStatusOf(service), null, 2);

    case 'help':
      printHelp();
      break;

    case 'init':
      Server.createProject();
      break;

    case 'serve':
      api().catch(console.log);
      break;

    default:
      throw new Error('Invalid command!');
  }

  return '';
}

function formatList(rows: any[]) {
  const sizes: Record<number, number> = {};
  const spaces = (size: number) => Array(size).fill(' ').join('');
  const rightPad = (string: string | any[], size: number) =>
    string.length < size ? string + spaces(size - string.length) : string;

  rows.forEach((row) => {
    row.forEach((column: any, index: number) => (sizes[index] = Math.max(sizes[index] | 0, String(column).length)));
  });

  const formattedList = rows.map((row) =>
    row.map((column: any, index: number) => rightPad(String(column), sizes[index])).join(' | '),
  );
  return formattedList.join('\n');
}
