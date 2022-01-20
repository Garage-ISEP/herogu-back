import { DockerImageNotFoundException, NoMysqlContainerException, DockerContainerNotFoundException, DockerImageBuildException } from './../errors/docker.exception';
import { Injectable, OnModuleInit } from '@nestjs/common';
import Dockerode, { Container, ContainerInfo, ContainerInspectInfo } from 'dockerode';
import { ContainerConfig, ContainerEvents, ContainerLabels, ContainerLogsConfig, ContainerStatus, DbCredentials, EventResponse } from 'src/models/docker/docker-container.model';
import { MailerService } from './mailer.service';
import { UniqueID } from "nodejs-snowflake";
import { AppLogger } from 'src/utils/app-logger.util';
import { ProjectCreationException } from 'src/errors/docker.exception';
import { Observable, Observer } from 'rxjs';
import { generatePassword } from 'src/utils/string.util';
import { GithubService } from './github.service';
@Injectable()
export class DockerService implements OnModuleInit {

  private readonly _docker = new Dockerode({ socketPath: process.env.DOCKER_HOST });
  private _statusListeners: Map<string, Observer<[ContainerStatus, number?]>> = new Map();

  constructor(
    private readonly _logger: AppLogger,
    private readonly _mail: MailerService,
    private readonly _github: GithubService,
  ) { }

  public async onModuleInit() {
    try {
      this._logger.log("Checking docker connection...");
      await this._docker.ping();
      await this._getMysqlContainerInfo();
      await this._listenStatusEvents();
      this._logger.log("Docker connection OK");
    } catch (e) {
      this._logger.log("Impossible to reach docker sock");
      this._logger.error(e);
    }
  }

  public async tryRemoveContainerFromName(name: string) {
    let containerId: string;
    try {
      containerId = await this._getContainerIdFromName(name);
    } catch (e) { }
    if (containerId) {
      try {
        await this._removeContainer(containerId);
        return true;
      } catch (e) { return false; }
    }
  }


  public async removeContainerFromName(name: string) {
    let containerId: string;
    try {
      containerId = await this._getContainerIdFromName(name);
    } catch (e) { }
    if (containerId) {
      await this._removeContainer(containerId);
    }
  }

  public async removeImageFromName(name: string) {
    try {
      await this._docker.getImage(name).remove();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Listen container logs,
   * Also print all the previous logs
   * The listener is called line by line for the logs
   * Throw an error if the container name doesn't exist
   */
  public async listenContainerLogs(name: string): Promise<Observable<string>> {
    try {
      const id = await this._getContainerIdFromName(name);
      const options: ContainerLogsConfig = {
        logs: true,
        stream: true,
        stdout: true,
        stderr: true,
      };
      const stream = await this._docker.getContainer(id).attach(options);
      return new Observable<string>(observer => {
        stream.on("data", (data: Buffer | string) => data.toString().split('\n').forEach(line => observer.next(line)));
        stream.on("error", (e) => observer.error(e));
        stream.on("close", () => observer.complete());
      });
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
    const labels = await this._getLabels(config.name, config.url, config.email);
    try {
      const repoSha = await this._github.getLastCommitSha(config.url);
      let imageSha: string;
      try {
        imageSha = (await this._docker.getImage(config.name)?.inspect())?.Config?.Labels?.["docker-ci.repo-sha"];
      } catch (e) { }
      if (imageSha !== repoSha)
        await this._buildImageFromRemote(config.url, config.name);
    } catch (e) {
      this._logger.error("Impossible to build image from url :", config.url);
      this._logger.error("Image doesn't exists, impossible to continue, incident will be reported");
      this._logger.error(e);
      // this._mail.sendErrorMail(this, "Error pulling image : ", e);
      throw new DockerImageNotFoundException();
    }
    try {
      await this.removeContainerFromName(config.name);
    } catch (e) {
      this._logger.error("Error removing container " + config.name);
      this._logger.error("Cannot continue container creation, incident will be reported");
      // this._mail.sendErrorMail(this, "Error removing container : ", e);
      return;
    }

    let error: string;
    for (let i = 0; i < 3; i++) {
      try {
        this._logger.log("Trying to create container :", config.name, "- iteration :", i);
        const container = await this._docker.createContainer({
          Image: config.name,
          name: config.name,
          Tty: true,
          Labels: labels as any,
          HostConfig: {
            RestartPolicy: { Name: "always" }
          },
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
    this._mail.sendErrorMail(this, "Error starting new container : ", error);
  }


  /**
   * Recreate a container from its ID
   * @param containerId 
   */
  public async recreateContainer(containerId: string) {
    try {
      let oldContainer: Container = this._docker.getContainer(containerId);
      const oldContainerInfo = await oldContainer.inspect();

      this._logger.log("Stopping container");
      await oldContainer.stop().catch();

      this._logger.log("Removing container");
      await oldContainer.remove({ force: true });
      // this._logger.log("Available images for this container : ", (await this._docker.listImages()));
      this._logger.log("Recreating container with image :", oldContainerInfo.Name);
      await new Promise(resolve => setTimeout(resolve, 3000));
      const container = await this._docker.createContainer({
        ...oldContainerInfo.Config,
        name: oldContainerInfo.Name,
        Image: oldContainerInfo.Name,
        NetworkingConfig: {
          EndpointsConfig: oldContainerInfo.NetworkSettings.Networks,
        },
        HostConfig: {
          Binds: oldContainerInfo.Mounts.map(el => `${el.Name}:${el.Destination}:${el.Mode}`)  //Binding volumes mountpoints in case of named volumes
        },
      });
      container.start();
      this._logger.info(`Container ${oldContainerInfo.Name} recreated and updated !`);
    } catch (e) {
      this._logger.error("Error recreating container :", e);
      throw new Error("Error recreating container : \n" + e);
    }
  }

  public async pullImage(image: string, config: ContainerConfig) {
    try {
      await this._docker.pull(image, { authconfig: config });
    } catch (e) {
      this._logger.error("Impossible to get image from url :", image);
      throw new DockerImageNotFoundException();
    }
  }

  public async pruneImages() {
    await this._docker.pruneImages();
  }

  /**
   * Create a mysql db with user
   * An optional sql fileName can be provided to hydrate the db 
   */
  public async createMysqlDBWithUser(projectName: string, dbName?: string, username?: string, password?: string): Promise<DbCredentials> {
    const creds = new DbCredentials(
      dbName || (await new UniqueID().asyncGetUniqueID() as string).substring(0, 6) + "-" + projectName.substring(0, 10),
      username || (await new UniqueID().asyncGetUniqueID() as string).substring(0, 6) + "-" + projectName.substring(0, 10),
      password || generatePassword()
    );
    try {
      await this._mysqlQuery(`CREATE DATABASE IF NOT EXISTS ${creds.dbName} CHARACTER SET utf8;`);
      await this._mysqlQuery(`CREATE USER IF NOT EXISTS '${creds.username}' IDENTIFIED BY '${creds.password}';`);
      await this._mysqlQuery(`GRANT ALL ON ${creds.dbName}.* TO '${creds.username}';`);
      await this._mysqlQuery("FLUSH PRIVILEGES;");
      await this._mysqlQuery("CREATE TABLE IF NOT EXISTS Bienvenue (Message varchar(255));", creds.dbName);
      await this._mysqlQuery(`INSERT INTO Bienvenue (Message) VALUES ("Salut ! Tu peux configurer ta BDD avec le logiciel de ton choix !");`, creds.dbName, creds.username, creds.password);
      return creds;
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationException("Error while Creating DB With USER");
    }
  }

  public async resetMysqlDB(projectName: string, dbName: string, username: string, password: string) {
    try {
      await this._mysqlQuery(`DROP USER IF EXISTS '${username}';`);
      await this._mysqlQuery(`DROP DATABASE IF EXISTS ${dbName};`);
      await this.createMysqlDBWithUser(projectName, dbName, username, password);
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationException("Error while resetting DB");
    }
  }

  /**
   * Execute sql commands, for instance from a .sql file
   */
  public async execSQLFile(sql: string, dbName: string, username: string, password: string) {
    // try {
    //   if (sql) new Parser().parse(sql);      
    // } catch (e) {
    //   console.error(e);
    //   throw new ProjectCreationException("Error when parsing SQL File", 2);
    // }
    try {
      await this._mysqlQuery(sql, dbName, username, password);
    } catch (e) {
      this._logger.error(e);
      console.error(e);
      throw new ProjectCreationException("Error while adding sql to db");
    }
  }

  /**
   * Start or stop the container from its tag name
   * throw docker error if can't stop or get container from name
   */
  public async toggleContainerFromName(name: string) {
    const id = await this._getContainerIdFromName(name);
    const container = await this._docker.getContainer(id).inspect();
    container.State.Running ? await this._docker.getContainer(id).stop() : await this._docker.getContainer(id).start();
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
  public async listenContainerStatus(name: string): Promise<Observable<[ContainerStatus, number]>> {
    const id = await this._getContainerIdFromName(name);
    const observable = new Observable<[ContainerStatus, number]>(observer => {
      this._statusListeners.set(id, observer);
      this._checkStatusEvents(id);
    });
    return observable;
  }
  public async checkMysqlConnection(dbName: string, username: string, password: string): Promise<boolean> {
    try {
      await this._mysqlQuery("SELECT 1;", dbName, username, password);
      return true;
    } catch (e) {
      return false;
    }
  }

  public async imageExists(name: string): Promise<boolean> {
    try {
      await this._docker.getImage(name).inspect();
      return true;
    } catch (e) { return false; }
  }
  /**
   * Execute a SQL query
   * By default it will execute a query with root creds
   * If specified it will execute a query with the given credentials and database name
   */
  private async _mysqlQuery(str: string, dbName?: string, user = "root", password = process.env.MYSQL_PASSWORD) {
    await this._mysqlExec('mysql', `--user=${user}`, `--password=${password}`, dbName ? `-e use ${dbName};${str}` : `-e ${str}`);
  }


  /**
   * Listen all docker container event,
   * If a container listener is added then the handler for this listener is triggerred
   */
  private async _listenStatusEvents() {
    const allowedActions: Partial<keyof typeof ContainerEvents>[] = [
      "create",
      "destroy",
      "die",
      "kill",
      "restart",
      "start",
      "stop",
      "update"
    ];
    try {
      (await this._docker.getEvents()).on("data", async (rawData) => {
        const data: EventResponse = JSON.parse(rawData);
        if (data.Type == "container" &&
          allowedActions.includes(data.Action as keyof typeof ContainerEvents) &&
          this._statusListeners.has(data.Actor.ID)) {
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
    let state: Dockerode.ContainerInspectInfo["State"];
    const handler = this._statusListeners.get(containerId);
    try {
      state = (await this._docker.getContainer(containerId).inspect()).State;
    } catch (e) {
      handler.next([ContainerStatus.NotFound]);
      handler.complete();
      console.log("handler completed");
      this._statusListeners.delete(containerId);
    }
    if (!state)
      handler.next([ContainerStatus.NotFound]);
    else {
      if (state.Restarting) handler.next([ContainerStatus.Restarting]);
      else if (state.Running) handler.next([ContainerStatus.Running]);
      else if (state.Dead) handler.next([ContainerStatus.Error, state.ExitCode]);
      else if (!state.Running) handler.next([ContainerStatus.Stopped, state.ExitCode]);
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
    throw new DockerContainerNotFoundException("No container found with name " + name);
  }

  private async _buildImageFromRemote(url: string, tag: string): Promise<void> {
    try {
      const token = await this._github.getInstallationToken(url);
      const mainBranch = await this._github.getMainBranch(url);
      const [owner, repo] = url.split("/").slice(-2);
      const lastCommitSha = await this._github.getLastCommitSha(url);
      url = `https://x-access-token:${token}@github.com/${owner}/${repo}.git#${mainBranch}`;
      this._logger.log("Building image from remote: " + url);
      await this._docker.buildImage({ context: ".", src: [] }, {
        t: tag,
        rm: true,
        forcerm: true,
        remote: url,
        dockerfile: "docker/Dockerfile",
        labels: {
          "docker-ci.repo-sha": lastCommitSha,
          "docker-ci.repo-url": url,
        }
      });
    } catch (e) {
      console.error(e);
      throw new DockerImageBuildException(e, url);
    }
  }

  private async _getLabels(name: string, url: string, email: string): Promise<ContainerLabels> {
    const [owner, repo] = url.split("/").slice(-2);
    const mainBranch = await this._github.getMainBranch(url);
    return {
      "docker-ci.enable": "true",
      "docker-ci.name": name,
      "docker-ci.repo": `https://x-access-token:{{TOKEN}}@github.com/${owner}/${repo}.git#${mainBranch}`,
      "docker-ci.email": email,
      "docker-ci.dockerfile": "docker/Dockerfile",
      "traefik.enable": 'true',
      [`traefik.http.routers.${name}-secure.rule`]: `Host(\`${name}.herogu.garageisep.com\`)`,
      [`traefik.http.routers.${name}-secure.entrypoints`]: "websecure",
      [`traefik.http.routers.${name}-secure.tls.certresolver`]: "myhttpchallenge",
      [`traefik.http.routers.${name}.rule`]: `Host(\`${name}.herogu.garageisep.com\`)`,
      [`traefik.http.routers.${name}.entrypoint`]: "web",
      [`traefik.http.routers.${name}.middlewares`]: "redirect",
      "traefik.http.middlewares.redirect.redirectscheme.scheme": "https",
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

  /**
   * Execute bash commands in the mysql container
   */
  private async _mysqlExec(...str: string[]) {
    const mysqlId = (await this._getMysqlContainerInfo()).Id;
    const container = this._docker.getContainer(mysqlId);
    return new Promise<void>(async (resolve, reject) => {
      const stream = (await (await container.exec({
        Cmd: str,
        AttachStdout: true,
        AttachStderr: true,
        Privileged: true,
        Tty: true
      })).start({
        stdin: true,
        hijack: true
      }));
      stream.on("data", (chunk: string) => {
        if (!stream.readable) return;
        if (chunk.toString().toLowerCase().includes("error"))
          reject(`Execution error : ${str.join(" ")}, ${chunk}`);
        else if (!chunk.toString().toLowerCase().includes("warning") && !str.reduce((acc, curr) => acc + curr, " ").includes("SELECT 1;"))
          this._logger.log(`Mysql command response [${str.join(" ")}] : ${chunk.includes('\n') ? '\n' + chunk : chunk}`);
      })
        .on("end", () => resolve())
        .on("error", (e) => reject(`Execution error : ${str.join(" ")}, ${e}`));
    });
  }

  private async _getMysqlContainerInfo(): Promise<ContainerInfo> {
    const infos = (await this._docker.listContainers()).find(el => el.Labels["tag"] == "mysql");
    if (!infos)
      throw new NoMysqlContainerException();
    return infos;
  }
}
