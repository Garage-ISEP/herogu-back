export interface ContainerConfig extends PullConfig {
  name: string;
  url: string;
  email: string;
  env: { [key: string]: string };
}

export interface ContainerLabels {
  "docker-ci.enable": string,
  "docker-ci.name": string,
  "docker-ci.repo": string,
  "docker-ci.email": string;
  
  "docker-ci.password"?: string;
  "docker-ci.username"?: string;
  "docker-ci.auth-server"?: string;
  "docker-ci.dockerfile"?: string;
  

  "traefik.enable": string,
  "traefik.http.middlewares.redirect.redirectscheme.scheme": string,
}

export interface ContainerLogsConfig {
  detachKeys?: string;
  logs: boolean;
  stream: boolean;
  stdin?: boolean;
  stdout: boolean;
  stderr?: boolean;
}

export enum ContainerStatus {
  Running = "Running",
  Error = "Error",
  Stopped = "Stopped",
  Restarting = "Restarting",
  NotFound = "NotFound"
}

export enum ContainerEvents {
  "attach",
  "commit",
  "copy",
  "create",
  "destroy",
  "detach",
  "die",
  "exec_create",
  "exec_detach",
  "exec_die",
  "exec_start",
  "export",
  "health_status",
  "kill",
  "oom",
  "pause",
  "rename",
  "resize",
  "restart",
  "start",
  "stop",
  "top",
  "unpause",
  "update",
};
export enum ImageEvents {
  "delete",
  "import",
  "load",
  "pull",
  "push",
  "save",
  "tag",
  "untag",
}

export interface EventResponse {
  Type: "container" | "image",
  Action: keyof typeof ContainerEvents | keyof typeof ImageEvents,
  Actor: {
    ID: string;
    Attributes: { [k: string]: string }
  },
  Time: number,
  TimeNano: number
}

export interface CreateDbConf {
  username: string;
  projectName: string;
}

export class DbCredentials {
  constructor(
    public dbName: string,
    public username: string,
    public password: string
  ) {}
}
export type PullConfig = {
  username: string,
  password: string,
  auth?: string,
  email?: string,
  serveraddress: string
};