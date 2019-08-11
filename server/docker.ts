import { join, readDirectory } from './io.js';
import { Log } from './log.js';
import { Shell, ExecAsync } from './shell.js';

export type PortSpecification = [number, number?];
export type VolumeSpecification = { host: string; container: string; flags?: string };

const logger = Log.create('docker');
const addSingleQuotes = (s: string | number) => "'" + String(s).replace(/\n/g, '\\n') + "'";
const escapeQuotes = (s: string | number) => String(s).replace(/'/g, "\\'");

interface DockerRawStatus {
  Id: string;
  Image: string;
  Name: string;
  State: {
    Status: string;
    Running: boolean;
    Paused: boolean;
  };
  Mounts: {
    Source: '/home/cloudy/data/7891687e56510ac3948ba7599f71e88974cc95d249f67a45d3bdeea162c1717c';
    Destination: '/opt/data';
    RW: boolean;
  }[];
  NetworkSettings: {
    Ports: {
      [name: string]: {
        HostPort: string;
      }[];
    };
  };
  Config: {
    Env: string[];
  };
}

interface DockerStatus {
  id: string;
  name: string;
  image: string;
  ports: PortSpecification[];
  volumes: VolumeSpecification[];
  env: Record<string, string>;
}

interface RunOptions {
  imageName: string;
  containerName?: string;
  volumes?: VolumeSpecification[];
  ports?: PortSpecification[];
  envVars?: Record<string, string | number>;
}

interface BuildOptions {
  imageName: string;
  buildArguments?: Record<string, string>;
}

class DockerImage {
  constructor(private imageFolder: string) {}

  build(options: BuildOptions) {
    try {
      const shellArgs = ['build', '-t', options.imageName];

      Object.entries(options.buildArguments || {}).forEach(([key, value]) => {
        shellArgs.push('--build-arg', key + '=' + addSingleQuotes(escapeQuotes(String(value))));
      });

      shellArgs.push('--build-arg', 'CACHEBUSTER=' + new Date().getTime());
      shellArgs.push(this.imageFolder);
      Shell.execAndLog('docker', shellArgs);
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to create image:\n' + error.message);
    }
  }

  runSync(options: RunOptions) {
    return this.runImage(options, true) as string;
  }

  runAsync(options: RunOptions) {
    return this.runImage(options, false) as ExecAsync;
  }

  private runImage(options: RunOptions, runDetached: boolean) {
    const shellArgs = ['run', '--rm'];
    if (runDetached) {
      shellArgs.push('-d');
    }

    if (options.envVars) {
      Object.entries(options.envVars).forEach(([key, value]) => {
        if (value !== '') {
          shellArgs.push('-e', escapeQuotes(key) + '=' + addSingleQuotes(escapeQuotes(value)));
          return;
        }

        shellArgs.push('-e', escapeQuotes(key));
      });
    }

    if (options.ports) {
      options.ports.forEach((ports) => {
        shellArgs.push('-p', ['127.0.0.1', ...this.normalizePorts(ports)].join(':'));
      });
    }

    if (options.volumes) {
      options.volumes.forEach((volume) => {
        shellArgs.push('-v', [volume.host, volume.container, volume.flags].filter(Boolean).join(':'));
      });
    }

    if (options.containerName) {
      shellArgs.push('--name', options.containerName);
    }

    const maxMemory = process.env.CLOUDY_MAX_MEMORY || '32mb';
    shellArgs.push(`--memory=${maxMemory}`, '--cpus=1');

    try {
      shellArgs.push(options.imageName);

      if (!runDetached) {
        return Shell.exec('docker', shellArgs);
      }

      return Shell.execAndLog('docker', shellArgs);
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to run image:\n' + error.message);
    }
  }

  private normalizePorts(port: PortSpecification): [number, number] {
    if (port[1]) {
      return [port[0], port[1]];
    }

    return [port[0], port[0]];
  }
}

export class DockerService {
  private baseImages: string[] = [];

  constructor(private imagesFolder: string) {
    this.loadImages();
  }

  private async loadImages() {
    this.baseImages = await readDirectory(this.imagesFolder);
  }

  getRunningContainers() {
    return Shell.execSync('docker', ['ps', '--format', '"{{.Names}}"']).trim().split('\n').filter(Boolean);
  }

  getAllImages() {
    return Shell.execSync('docker', ['image', 'ls', '--format', '"{{.Repository}}"'])
      .trim()
      .split('\n')
      .filter((s) => s !== '<none>');
  }

  hasBaseImage(imageName: string) {
    return this.baseImages.includes(imageName);
  }

  deleteImage(imageName: string) {
    Shell.execSync('docker', ['image', 'rm', imageName]);
  }

  getBaseImage(imageName: string) {
    if (this.hasBaseImage(imageName)) {
      return new DockerImage(join(this.imagesFolder, imageName));
    }

    return null;
  }

  stopContainer(name: string) {
    const runningContainers = this.getRunningContainers();

    if (runningContainers.includes(name)) {
      Shell.execAndLog('docker', ['stop', '--time', '2', name]);
      return;
    }

    try {
      Shell.execAndLog('docker', ['rm', name]);
    } catch {}
  }

  getStatus(containerName?: string): DockerStatus[] {
    const containerNames = containerName ? [containerName] : this.getRunningContainers();

    const containers: DockerRawStatus[] = containerNames.length
      ? JSON.parse(Shell.execSync('docker', ['inspect', ...containerNames]))
      : [];

    return containers.map((container) => {
      const ports: PortSpecification[] = [];

      Object.entries(container.NetworkSettings.Ports)
        .filter(([_, value]) => !!value)
        .forEach(([name, hostPorts]) => {
          const containerPort = Number(name.replace(/\D+/g, ''));

          hostPorts.forEach((host) => {
            const hostPort = Number(host.HostPort);
            ports.push([hostPort, containerPort]);
          });
        });

      const volumes: VolumeSpecification[] = container.Mounts.map((mount) => ({
        host: mount.Source,
        container: mount.Destination,
        flags: mount.RW ? '' : 'ro',
      }));

      const env: Record<string, string> = {};
      container.Config.Env.forEach((envLine) => {
        const variable = envLine.split('=', 1)[0];
        const value = envLine.slice(variable.length + 1);

        env[variable] = value;
      });

      return {
        id: container.Id,
        name: container.Name.slice(1),
        image: container.Image,
        ports,
        volumes,
        env,
      };
    });
  }
}
