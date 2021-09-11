import { Injectable, OnModuleInit } from '@nestjs/common';
import Dockerode, { Container, ContainerInspectInfo } from 'dockerode';
import { ContainerConfig, ContainerEvents, ContainerLabels, ContainerLogsConfig, ContainerStatus, DbCredentials, EventResponse } from 'src/models/docker/docker-container.model';
import { MailerService } from './mailer.service';
import { UniqueID } from "nodejs-snowflake";
import { Parser } from 'node-sql-parser';
import { dockerLabelsConf } from 'src/config/docker.conf';
import { AppLogger } from 'src/utils/app-logger.util';
import { ProjectCreationException } from 'src/errors/docker.exception';
import { Observable } from 'rxjs';
@Injectable()
export class DockerService implements OnModuleInit {
  
  private readonly _docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
  private _statusListeners: { [id: string]: (status: ContainerStatus, exitCode?: number) => void } = {};

  constructor(
    private readonly _logger: AppLogger,
    private readonly _mail: MailerService,
  ) { }

  public async onModuleInit() {
    try {
      await this._docker.ping();
      await this._listenStatusEvents();
      this._logger.log("DockerService enabled");
    } catch (e) {
      this._logger.log("Impossible to reach docker sock");
      this._logger.error(e);
    }
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
    const labels = this._getLabels(config.name, config.url, config.email);
    try {
      (await this._getImageIdFromUrl(config.url)) || (await this._docker.pull(config.url));
    } catch (e) {
      this._logger.info("Impossible to get image from url :", config.url);
      this._logger.info("Image doesn't exists, impossible to continue, incident will be reported");
      this._mail.sendErrorMail(this, "Error pulling image : ", e);
    }
    try {
      await this.removeContainerFromName(config.name);
    } catch (e) {
      this._logger.info("Error removing container " + config.name);
      this._logger.info("Cannot continue container creation, incident will be reported");
      this._mail.sendErrorMail(this, "Error removing container : ", e);
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
    this._mail.sendErrorMail(this, "Error starting new container : ", error);
  }

  /**
   * Create a mysql db with user
   * An optional sql fileName can be provided to hydrate the db 
   */
  public async createMysqlDBWithUser(projectName: string, sql?: string): Promise<DbCredentials> {
    const creds = new DbCredentials(
      (await new UniqueID().asyncGetUniqueID() as string).substr(0, 6) + "_" + projectName.substr(0, 64),
      (await new UniqueID().asyncGetUniqueID() as string).substr(0, 6) + "_" + projectName.substr(0, 10),
      await new UniqueID().asyncGetUniqueID() as string
    );
    try {
      await this._mysqlQuery(`CREATE DATABASE IF NOT EXISTS ${creds.dbName} CHARACTER SET utf8`);
      await this._mysqlQuery(`CREATE USER IF NOT EXISTS '${creds.username}' IDENTIFIED BY '${creds.password}'`);
      await this._mysqlQuery(`GRANT ALL ON ${creds.dbName}.* TO '${creds.username}'`);
      await this._mysqlQuery("FLUSH PRIVILEGES");
      await this._mysqlQuery("CREATE TABLE Bienvenue (Message varchar(255))", creds.dbName);
      if (sql) await this.execSQLFile(sql, creds.dbName, creds.username, creds.password);
      await this._mysqlQuery(`INSERT INTO Bienvenue (Message) VALUES ("Salut ! Tu peux configurer ta BDD avec le logiciel de ton choix !")`, creds.dbName, creds.username, creds.password);
      return creds;
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationException("Error while Creating DB With USER");
    }
  }

  /**
   * Execute sql commands, for instance from a .sql file
   */
  public async execSQLFile(sql: string, dbName: string, username: string, password: string) {
    try {
      if (sql) new Parser().parse(sql);      
    } catch (e) {
      throw new ProjectCreationException("Error when parsing SQL File");
    }
    try {
      await this._mysqlQuery(sql, dbName, username, password);
    } catch (e) {
      this._logger.error(e);
      throw new ProjectCreationException("Error while adding sql to db");
    }
  }

  /**
   * Stop the container from its tag name
   * throw docker error if can't stop or get container from name
   */
  public async stopContainerFromName(name: string) {
    const id = await this._getContainerIdFromName(name);
    await this._docker.getContainer(id).stop();
  }

  /**
   * Start the cotnainer from its tag name
   * throw a docker error if can't start or get container from name
   */
  public async startContainerFromName(name: string) {
    const id = await this._getContainerIdFromName(name);
    await this._docker.getContainer(id).start();
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
      "update",
    ];
    try {
      (await this._docker.getEvents()).on("data", async (rawData) => {
        const data: EventResponse = JSON.parse(rawData);
        if (data.Type == "container" &&
          allowedActions.includes(data.Action as keyof typeof ContainerEvents) &&
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
      ...dockerLabelsConf,
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
    const mysqlId = (await this._docker.listContainers()).find(el => el.Labels["tag"] == "mysql").Id;
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
        else if (!chunk.toString().toLocaleLowerCase().includes("warning"))
          this._logger.log(`Mysql command response [${str.join(" ")}] : ${chunk}`);
      })
      .on("end", () => resolve())
      .on("error", (e) => reject(`Execution error : ${str.join(" ")}, ${e}`));
    });
  }
}