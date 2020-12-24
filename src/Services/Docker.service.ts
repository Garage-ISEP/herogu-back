import { ContainerLogsConfig } from './Model/ContainerLogsConfig';
import { ContainerLabels } from './Model/ContainerLabels';
import { ContainerConfig } from './Model/ContainerConfig';
import { ContainerStatus } from './Model/ContainerStatus';
import { DockerEventsModel } from './Model/DockerEvents';
import * as Dockerode from "dockerode";
import { Container, ContainerInspectInfo } from "dockerode";
import { Logger } from "../Utils/Logger.service";
import mailerService from './Mailer.service';

class DockerService {
  private _docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
  private _logger = new Logger(this);
  private _statusListeners: { [id: string]: (status: ContainerStatus, exitCode?: number) => void };

  async init() {
    try {
      await this._docker.ping();
      await this._listenStatusEvents();
      this._logger.log("DockerService enabled");
    } catch (e) {
      this._logger.log("Impossible to reach docker sock");
      this._logger.error(e);
      process.exit(1);
    }
  }

  /**
   * Listen all docker container event,
   * If a container listener is added then the handler for this listener is triggerred
   */
  async _listenStatusEvents() {
    const allowedActions: (Partial<keyof typeof DockerEventsModel.ContainerEvents>)[] = [
      "create", "destroy", "die", "kill", "restart", "start", "stop", "update"
    ];
    (await this._docker.getEvents()).on("data", async (rawData) => {
      const data: DockerEventsModel.EventResponse = JSON.parse(rawData);

      if (data.Type == "container"
        && allowedActions.includes(data.Action as keyof typeof DockerEventsModel.ContainerEvents)
        && Object.keys(this._statusListeners).includes(data.Actor.ID)) {
        try {
          const state = (await this._docker.getContainer(data.Actor.ID).inspect()).State;  
          const handler = this._statusListeners[data.Actor.ID];
          if (state.Restarting)
            handler(ContainerStatus.Restarting);
          else if (state.Running)
            handler(ContainerStatus.Running);
          else if (state.Dead)
            handler(ContainerStatus.Error, state.ExitCode);
        } catch (e) {
          this._logger.error(e);
        }
      }      
    });
  }

  /**
   * Get all container logs
   * Line by line
   */
  async getContainerLogs(name: string): Promise<string[]> {
    try {
      const id = await this._getContainerIdFromName(name);
      const options: ContainerLogsConfig = {
        logs: true,
        stream: false,
        stdout: true,
        stderr: true
      }
      return (await this._docker.getContainer(id).attach(options)).read().toString().split('\n');
    } catch (e) {
      throw new Error("Cannot find container with name " + name);
    }
  }

  /**
   * Listen container logs,
   * a listener can be added in parameter
   * or the data can be listened from the output stream
   * @param name 
   */
  async listenContainerLogs(name: string, listener?: (data: string) => void): Promise<NodeJS.ReadWriteStream> {
    try {
      const id = await this._getContainerIdFromName(name);
      const options: ContainerLogsConfig = {
        logs: false,
        stream: true,
        stdout: true,
        stderr: true
      }
      const stream = await this._docker.getContainer(id).attach(options);
      return listener ? stream.on("data", (data: Buffer | string) => listener(data.toString())) : stream;
    } catch (e) {
      throw new Error("Cannot find container with name " + name);
    }
  }

  /**
   * Create a container from the given config
   * In case of failure 
   * @param config 
   */
  public async createContainerFromConfig(config: ContainerConfig): Promise<Container | null> {
    const labels: ContainerLabels = {
      "docker-ci.enable": 'true',
      "docker-ci.name": config.name,
      "docker-ci.repo-url": config.url,

      "traefik.enable": 'true',
      [`traefik.http.routers.${config.name}-secure.rule`]: `Host(\`${config.name}.herogu.garageisep.com\`)`,
      [`traefik.http.routers.${config.name}-secure.entrypoints`]: "websecure",
      [`traefik.http.routers.${config.name}-secure.certresolver`]: "myhttpchallenge",
      "traefik.http.middlewares.redirect.redirectscheme.scheme": "https",
      [`traefik.http.routers.${config.name}.entrypoint`]: "web",
      [`traefik.http.routers.${config.name}.middlewares`]: "redirect",
    };
    let error: string;
    for (let i = 0; i < 3; i++) {
      try {
        this._logger.log("test " + i);
        return await this._docker.createContainer({
          Image: config.url,
          name: config.name,
          Tty: true,
          Labels: labels as any,
          ExposedPorts: {
            '80': 80
          },
          Env: Object.keys(config.env).map(key => key + '=' + config.env[key]),
          NetworkingConfig: {
            EndpointsConfig: {
              "web": {}
            }
          },
        });
      } catch (e) {
        error = e;
        this._logger.error(e);
      }
    }
    this._logger.log("Container not created after 3 times, incident will be reported.");
    mailerService.sendErrorMail(this, error);
  }

  /**
   * Get a container from its name
   */
  public async _getContainerIdFromName(name: string): Promise<string | null> {
    try {
      for (const el of await this._docker.listContainers()) {
        if (el.Names.includes(name))
          return el.Id;
      }
    } catch (e) {
      this._logger.error(e);
      throw new Error("Cannot find container with name" + name);
    }
  }

  /**
   * Get container info
   */
  public async getContainerInfoFromName(name: string): Promise<ContainerInspectInfo | null> {
    try {
      const id = await this._getContainerIdFromName(name);
      return await this._docker.getContainer(id).inspect();
    } catch (e) {
      this._logger.error(e);
    }
  }

  /**
   * Add ad container status listener
   */
  public async registerContainerStatusListener(name: string, handler: (status: ContainerStatus, exitCode: number) => void): Promise<void> {
    let id: string;
    try {
      id = await this._getContainerIdFromName(name);
    } catch (e) {
      throw new Error("Cannot find container with name " + name);
    }
    this._statusListeners[id] = handler;
  }
}

export default new DockerService();