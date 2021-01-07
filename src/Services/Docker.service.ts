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
import * as shortUuid from "short-uuid";
import * as fs from "fs";
import { ProjectCreationError } from "../Utils/ProjectCreationError";
class DockerService {
  private _docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
  private _logger = new Logger(this);
  private _statusListeners: { [id: string]: (status: ContainerStatus, exitCode?: number) => void } = {};

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
            this._checkStatusEvents(data.Actor.ID);
          } catch (e) {
            this._logger.error(e);
          }
        }
      });
    } catch (e) {
      throw new Error("Error creating docker event listener");
    }
  }

  private async _checkStatusEvents(containerId: string) {
    const state = (await this._docker.getContainer(containerId).inspect()).State;
    const handler = this._statusListeners[containerId];

    if (state.Restarting) handler(ContainerStatus.Restarting);
    else if (state.Running) handler(ContainerStatus.Running);
    else if (state.Dead) handler(ContainerStatus.Error, state.ExitCode);
    else if (!state.Running) handler(ContainerStatus.Stopped, state.ExitCode);
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

  private _getLabels(name: string, url: string, email: string): ContainerLabels {
    return {
      "docker-ci.name": name,
      "docker-ci.repo-url": url,
      "docker-ci.email": email,
      [`traefik.http.routers.${name}-secure.rule`]: `Host(\`${name}.herogu.garageisep.com\`)`,
      [`traefik.http.routers.${name}-secure.entrypoints`]: "websecure",
      [`traefik.http.routers.${name}-secure.certresolver`]: "myhttpchallenge",
      [`traefik.http.routers.${name}.entrypoint`]: "web",
      [`traefik.http.routers.${name}.middlewares`]: "redirect",
      ...DefaultDockerLabels,
    };
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

  /**
   * Listen container logs,
   * Also print all the previous logs
   * The listener is called line by line for the logs
   * Throw an error if the container name doesn't exist
   */
  public async listenContainerLogs(name: string, listener?: (data: string) => void) {
    try {
      const id = await this._getContainerIdFromName(name);
      const options: ContainerLogsConfig = {
        logs: true,
        stream: true,
        stdout: true,
        stderr: true,
      };
      const stream = await this._docker.getContainer(id).attach(options);
      stream.on("data", (data: Buffer | string) =>
        data.toString().split('\n').forEach(line => listener(line))
      );
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
    const labels = this._getLabels(config.name, config.url, config.email);
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
   * Create a mysql db with user
   * An optional sql fileName can be provided to hydrate the db 
   */
  public async createMysqlDBWithUser(projectName: string, fileName?: string): Promise<{dbName: string, username: string, password: string}> {
    const username = shortUuid().generate().substr(0, 6) + "_" + projectName.substr(0, 10);
    const dbName = shortUuid().generate().substr(0, 6) + "_" + projectName.substr(0, 64);
    const password = shortUuid().generate();
    try {
      await this._mysqlQuery(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8`);
      await this._mysqlQuery(`CREATE USER IF NOT EXISTS '${username}' IDENTIFIED BY '${password}'`);
      await this._mysqlQuery(`GRANT ALL ON ${dbName}.* TO '${username}'`);
      await this._mysqlQuery("FLUSH PRIVILEGES");
      await this._mysqlQuery("CREATE TABLE Bienvenu (Message varchar(255))", dbName);
      if (fileName) {
        await this._mysqlExec(`mysql --user=${username} --password=${password} ${dbName} < /tmp/mysql-bridge/${fileName}`);
        await this._mysqlExec(`rm /tmp/mysql-bridge/${fileName}`);
      }
      await this._mysqlQuery(`INSERT INTO Bienvenu (Message) VALUES ("Salut ! Tu peux configurer ta BDD avec le logiciel de ton choix !")`, dbName, username, password);
      return { dbName, username, password };
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationError("Error while Creating DB With USER");
    }
  }

  public async stopContainerFromName(name: string) {
    const id = await this._getContainerIdFromName(name);
    await this._docker.getContainer(id).stop();
  }

  /**
   * Get container info
   * Throw an error if the container doesn't exist
   */
  public async getContainerInfoFromName(name: string): Promise<ContainerInspectInfo | null> {
    const id = await this._getContainerIdFromName(name);
    return await this._docker.getContainer(id).inspect();
  }

  /**
   * Listen container Status changes
   * The handler will be called with the actual status at the end of this method
   * Throw an error if there is no container with this name
   */
  public async listenContainerStatus(name: string, handler: (status: ContainerStatus, exitCode: number) => void): Promise<void> {
    let id: string;
    try {
      id = await this._getContainerIdFromName(name);
    } catch (e) {
      throw new Error("Cannot find container with name " + name);
    }
    this._statusListeners[id] = handler;
    await this._checkStatusEvents(id).catch((e) => console.error(e));
  }

  private async _mysqlQuery(str: string, dbName?: string, user = "root", password = process.env.MYSQL_PASSWORD) {
    await this._mysqlExec('mysql', `--user=${user}`, `--password=${password}`, dbName ? `-e use ${dbName};${str}` : `-e ${str}`);
  }

  private async _mysqlExec(...str: string[]) {
    const mysqlId = (await this._docker.listContainers()).find(el => el.Labels["tag"] == "mysql").Id;
    const container = this._docker.getContainer(mysqlId);
    return new Promise<void>(async (resolve, reject) => {
      (await (await container.exec({
        Cmd: str,
        AttachStdout: true,
        AttachStderr: true,
        Privileged: true,
      })).start({})).on("data", (chunk: string) => {
        if (chunk.toString().toLowerCase().includes("error"))
          reject(`Execution error : ${str}, ${chunk}`);
        else if (!chunk.toString().toLocaleLowerCase().includes("warning"))
          this._logger.log(`Mysql command response [${str}] : ${chunk}`);
      }).on("end", () => resolve()).on("error", (e) => reject(`Execution error : ${str}, ${e}`));
    });
  }
}

export default new DockerService();