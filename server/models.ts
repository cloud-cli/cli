export interface ServiceConfiguration {
  id: string;
  name: string;
  type: string;
  branch: string;
  repository: string;
  webSocket?: { path: string };
  domains: string[];
  env: Record<string, string | number>;
  memory?: string;
  online?: boolean;
  ports: {
    port: number;
    hostPort: number;
    webSocketPort?: number;
  };
}

export interface PublicServiceConfiguration {
  type?: string;
  domain?: string;
  port?: number;
  env?: Record<string, string | number>;
  webSocket?: { path: string };
  memory?: string;
}

export interface Service {
  repository: string;
  branch: string;
}
