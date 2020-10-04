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
      cy ls                           List all services
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

    ## Container commands
      cy images                       List available images

  `);
}

class CloudyCommands {
  async create(service: Service) {
    await Services.create(service);
    Server.reload();
  }

  async build(service: Service) {
    const configuration = await GitHub.fetchServiceConfiguration(service);
    await Services.create(service, configuration);
    await Services.build(service, configuration);
    await Services.runInBackground(service, configuration);
    Server.reload();
  }

  async run(service: Service) {
    await Services.runAndExit(service);
  }

  async destroy(service: Service) {
    await Services.destroy(service);
    Server.reload();
  }

  async createKey(service: Service) {
    const { repository } = service;
    const repositoryExists = await GitHub.exists(repository);
    if (!repositoryExists) {
      throw new Error('Repository not found');
    }

    const key = await KeyManager.createServiceKey(service);
    Server.reload();

    return key;
  }

  getKey(service: Service) {
    return KeyManager.getServiceKey(service);
  }

  deleteKey(service: Service) {
    return KeyManager.deleteServiceKey(service);
  }

  stop(service: Service) {
    Services.stop(service);
  }

  start(service: Service) {
    Services.runInBackground(service);
  }

  restart(service: Service) {
    this.stop(service);
    this.start(service);
  }

  async restartAll() {
    for (const service of Services.getStatus()) {
      await Services.stop(service);
      await Services.runInBackground(service);
    }

    Server.reload();
  }

  async buildAll() {
    for (const service of Services.getStatus()) {
      await Services.build(service);
      await Services.runInBackground(service);
    }

    Server.reload();
  }

  ls(_: Service, args: string[]) {
    const services = Services.getStatus().map((service) => ({
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
  }

  status(service: Service) {
    return JSON.stringify(Services.getStatusOf(service), null, 2);
  }

  help() {
    printHelp();
  }

  init() {
    Server.createProject();
  }

  serve() {
    return api();
  }
}

export async function cli(args: string[]) {
  const command = String(args.shift());
  const [repository, branch] = args;
  const service: Service = { repository, branch: branch || 'master' };
  const commandAsMethod = command.replace(/-([a-z]{1})/g, (_, letter) => letter.toUpperCase()) as keyof CloudyCommands;
  const cloudy = new CloudyCommands();

  if (commandAsMethod in cloudy) {
    return cloudy[commandAsMethod](service, args);
  }

  throw new Error('Invalid command!');
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
