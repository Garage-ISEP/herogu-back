import { ContainerLogsConfig } from "./Model/ContainerLogsConfig";
import { ContainerLabels } from "./Model/ContainerLabels";
import { ContainerConfig } from "./Model/ContainerConfig";
import { ContainerStatus } from "./Model/ContainerStatus";
import { DockerEventsModel } from "./Model/DockerEvents";
import DefaultDockerLabels from "./Conf/DefaultDockerLabels";
import * as Dockerode from "dockerode";
import { Container, ContainerInspectInfo } from "dockerode";
import { Logger } from "../Utils/Logger.service";
import mailerService from "./Mailer.service";

class DockerService {
  private _docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
  private _logger = new Logger(this);
  private _statusListeners: {
    [id: string]: (status: ContainerStatus, exitCode?: number) => void;
  } = {};

  public async init() {
    try {
      await this._docker.ping();
      await this._listenStatusEvents();
      this._logger.log("DockerService enabled");
    } catch (e) {
      this._logger.log("Impossible to reach docker sock");
      this._logger.error(e);
    }
  }

  /**
   * Listen all docker container event,
   * If a container listener is added then the handler for this listener is triggerred
   */
  private async _listenStatusEvents() {
    const allowedActions: Partial<keyof typeof DockerEventsModel.ContainerEvents>[] = [
      "create",
      "destroy",
      "die",
      "kill",
      "restart",
      "start",
      "stop",
      "update",
    ];
    try {
      (await this._docker.getEvents()).on("data", async (rawData) => {
        const data: DockerEventsModel.EventResponse = JSON.parse(rawData);
        if (data.Type == "container" &&
          allowedActions.includes(data.Action as keyof typeof DockerEventsModel.ContainerEvents) &&
          Object.keys(this._statusListeners).includes(data.Actor.ID)) {
          try {
            const state = (await this._docker.getContainer(data.Actor.ID).inspect()).State;
            const handler = this._statusListeners[data.Actor.ID];

            if (state.Restarting) handler(ContainerStatus.Restarting);
            else if (state.Running) handler(ContainerStatus.Running);
            else if (state.Dead) handler(ContainerStatus.Error, state.ExitCode);
            else if (!state.Running) handler(ContainerStatus.Stopped);
          } catch (e) {
            this._logger.error(e);
          }
        }
      });
    } catch (e) {
      throw new Error("Error creating docker event listener");
    }
  }

  /**
   * Get a container from its name
   */
  private async _getContainerIdFromName(name: string): Promise<string | null> {
    name = "/" + name;
    try {
      for (const el of await this._docker.listContainers({ all: true })) {
        if (el.Names.includes(name)) return el.Id;
      }
    } catch (e) {
      this._logger.error(e);
    }
  }

  /**
   * Get a local image id from its url
   * @param url
   */
  private async _getImageIdFromUrl(url: string): Promise<string | null> {
    try {
      for (const el of await this._docker.listImages({ all: true })) {
        if (el.RepoTags.includes(url)) return el.Id;
      }
    } catch (e) {
      this._logger.error(e);
    }
  }

  /**
   * Stop and remove container
   */
  private async _removeContainer(id: string) {
    const container = this._docker.getContainer(id);
    try {
      await container.stop();
    } catch (e) {
      this._logger.info("Container cannot stop, trying to remove directly...");
    }
    await container.remove({ force: true });
  }

  public async removeContainerFromName(name: string) {
    const containerId = await this._getContainerIdFromName(name);
    if (containerId)
      await this._removeContainer(containerId);
  }

  private _getLabels(name: string, url: string): ContainerLabels {
    return {
      "docker-ci.name": name,
      "docker-ci.repo-url": url,
      [`traefik.http.routers.${name}-secure.rule`]: `Host(\`${name}.herogu.garageisep.com\`)`,
      [`traefik.http.routers.${name}-secure.entrypoints`]: "websecure",
      [`traefik.http.routers.${name}-secure.certresolver`]: "myhttpchallenge",
      [`traefik.http.routers.${name}.entrypoint`]: "web",
      [`traefik.http.routers.${name}.middlewares`]: "redirect",
      ...DefaultDockerLabels,
    };
  }

  /**
   * Get all container logs
   * Line by line
   */
  public async getContainerLogs(name: string): Promise<string[]> {
    try {
      const id = await this._getContainerIdFromName(name);
      const options: ContainerLogsConfig = {
        logs: true,
        stream: false,
        stdout: true,
        stderr: true,
      };
      return (await this._docker.getContainer(id).attach(options)).read().toString().split("\n");
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
  public async listenContainerLogs(name: string, listener?: (data: string) => void): Promise<NodeJS.ReadWriteStream> {
    try {
      const id = await this._getContainerIdFromName(name);
      const options: ContainerLogsConfig = {
        logs: false,
        stream: true,
        stdout: true,
        stderr: true,
      };
      const stream = await this._docker.getContainer(id).attach(options);
      return listener ? stream.on("data", (data: Buffer | string) => listener(data.toString())) : stream;
    } catch (e) {
      throw new Error("Cannot find container with name " + name);
    }
  }

  /**
   * Create a container from the given config
   * If the image doesn't exist, it'll be pulled from the given url
   * If a container with the same name already exist the former container is stopped and removed
   * In case of failure, it retries 3 times
   */
  public async launchContainerFromConfig(config: ContainerConfig): Promise<Container | null> {
    const labels = this._getLabels(config.name, config.url);
    try {
      (await this._getImageIdFromUrl(config.url)) || (await this._docker.pull(config.url));
    } catch (e) {
      this._logger.info("Impossible to get image from url :", config.url);
      this._logger.info("Image doesn't exists, impossible to continue, incident will be reported");
      mailerService.sendErrorMail(this, "Error pulling image : ", e);
    }
    try {
      await this.removeContainerFromName(config.name);
    } catch (e) {
      this._logger.info("Error removing container " + config.name);
      this._logger.info("Cannot continue container creation, incident will be reported");
      mailerService.sendErrorMail(this, "Error removing container : ", e);
      return;
    }

    let error: string;
    for (let i = 0; i < 3; i++) {
      try {
        this._logger.log("Trying to create container :", config.name, "- iteration :", i);
        const container = await this._docker.createContainer({
          Image: config.url,
          name: config.name,
          Tty: true,
          Labels: labels as any,
          ExposedPorts: {
            '80': {}
          },
          Env: Object.keys(config.env).map(
            (key) => key + "=" + config.env[key]
          ),
          NetworkingConfig: {
            EndpointsConfig: {
              web: { Aliases: ["web"] },
            },
          },
        });
        await container.start({});
        this._logger.info("Container", config.name, "created and started");
        return container;
      } catch (e) {
        error = e;
        this._logger.error(e);
        this._logger.log("Impossible to create or start the container, trying one more time");
      }
    }
    this._logger.log("Container not created or started after 3 times, incident will be reported.");
    mailerService.sendErrorMail(this, "Error starting new container : ", error);
  }

  /**
   * Get container info
   */
  public async getContainerInfoFromName(
    name: string
  ): Promise<ContainerInspectInfo | null> {
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
  public async registerContainerStatusListener(
    name: string,
    handler: (status: ContainerStatus, exitCode: number) => void
  ): Promise<void> {
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
