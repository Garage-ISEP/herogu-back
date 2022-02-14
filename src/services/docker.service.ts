import { DockerDf } from './../models/docker/docker-df.model';
import { CacheMap } from './../utils/cache.util';
import { Project, ProjectType } from 'src/database/project.entity';
import { DockerImageNotFoundException, NoMysqlContainerException, DockerContainerNotFoundException, DockerImageBuildException } from './../errors/docker.exception';
import { Injectable, OnModuleInit } from '@nestjs/common';
import Dockerode, { Container, ContainerInfo, ContainerInspectInfo } from 'dockerode';
import { ContainerEvents, ContainerLabels, ContainerLogsConfig, ContainerStatus, EventResponse } from 'src/models/docker/docker-container.model';
import { MailerService } from './mailer.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { Observable, Observer } from 'rxjs';
import { GithubService } from './github.service';
@Injectable()
export class DockerService implements OnModuleInit {

  private readonly _docker = new Dockerode({ socketPath: process.env.DOCKER_HOST });
  private _statusListeners: Map<string, Observer<[ContainerStatus, number?]>> = new Map();
  //Stores the container ids from the project name in cache for 10 minutes
  private readonly _containerIdMap: CacheMap<string, string> = new CacheMap(60_000 * 10);
  constructor(
    private readonly _logger: AppLogger,
    private readonly _mail: MailerService,
    private readonly _github: GithubService,
  ) {
    this._github.onContainerUpdate = (project) => this.launchContainerFromConfig(project, false);
  }

  public async onModuleInit() {
    try {
      this._logger.log("Checking docker connection...");
      await this._docker.ping();
      await this._listenStatusEvents();
      this._logger.log("Docker connection OK");
    } catch (e) {
      this._logger.log("Impossible to reach docker sock");
      this._logger.error(e);
    }
  }

  public async removeContainerFromName(name: string, removeVolumes = false) {
    let containerId: string;
    this._logger.log("Removing container", removeVolumes ? "and volumes" : "", name);
    try {
      containerId = await this._getContainerIdFromName(name);
    } catch (e) { }
    if (containerId) {
      await this._removeContainer(containerId, removeVolumes);
      this._containerIdMap.delete(name);
    }
    this._logger.log("Container removed", name);
  }

  public async removeImageFromName(name: string) {
    this._logger.log("Removing image", name);
    if (!await this.imageExists(name)) {
      this._logger.log("Image not found", name);
      return;
    }
    try {
      await this._docker.getImage(name).remove();
      this._logger.log("Image removed", name);
    } catch (e) {
      this._logger.error("Could not remove image", name, e);
    }
  }

  /**
   * @returns all herogu containers with their disk space usage
   */
  public async getContainersDataUsage(): Promise<DockerDf.Container[]> {
    return (await this._docker.df() as DockerDf.DockerDf).Containers
      .filter(container => container.Labels["herogu.enabled"] === "true");
  }

  public async getContainerInfosFromName(name: string): Promise<ContainerInspectInfo & { SizeRw: number, SizeRootFs: number }> {
    return await (await this.getContainerFromName(name)).inspect({ size: true }) as ContainerInspectInfo & { SizeRw: number, SizeRootFs: number };
  }

  /**
   * Listen container logs,
   * Also print all the previous logs
   * The listener is called line by line for the logs
   * Throw an error if the container name doesn't exist
   * Can be used for instance for nodejs container or other
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
   * @param project the project with the config we have to deploy
   * @param force if true, the container will be recreated even if it already exists
   */
  public async launchContainerFromConfig(project: Project, forceRecreate = true): Promise<Container | null> {
    if (!await this._github.verifyConfiguration(project.githubLink, project.installationId, project.shas)) {
      this._logger.log("Project configuration is not valid, resetting configuration");
      project.shas = await this._github.addOrUpdateConfiguration(project);
      await project.save();
    }
    const previousImageId = (await this._docker.getImage(project.name)?.inspect())?.Id;
    try {
      const repoSha = await this._github.getLastCommitSha(project.githubLink);
      let imageSha: string;
      try {
        imageSha = await this.getImageCommitSha(project.name);
      } catch (e) { }
      if (imageSha !== repoSha)
        await this._buildImageFromRemote(project.githubLink, project.name);
      else if (!forceRecreate) {
        this._logger.log("Image already exists, not rebuilding");
        return;
      }
    } catch (e) {
      this._logger.error("Impossible to build image from url :" + project.githubLink);
      this._logger.error("Image doesn't exists, impossible to continue, incident will be reported");
      this._logger.error(e);
      // this._mail.sendErrorMail(this, "Error pulling image : ", e);
      throw new DockerImageNotFoundException();
    }
    try {
      await this.removeContainerFromName(project.name);
    } catch (e) {
      this._logger.error("Error removing container " + project.name);
      this._logger.error("Cannot continue container creation, incident will be reported");
      // this._mail.sendErrorMail(this, "Error removing container : ", e);
      return;
    }
    let error: string;
    for (let i = 0; i < 3; i++) {
      try {
        this._logger.log("Trying to create container :", project.name, "- iteration :", i);
        const container = await this._docker.createContainer({
          Image: project.name,
          name: project.name,
          Tty: true,
          Labels: this._getLabels(project.name) as any,
          HostConfig: {
            RestartPolicy: { Name: "always" },
            PortBindings: process.env.NODE_ENV == "dev" ? {
              "80/tcp": [{ HostPort: "8081" }],
            } : null,
            Mounts: [{
              Source: `${project.name}-config`,
              Target: '/etc',
              Type: "volume"
            }]
          },
          ExposedPorts: {
            '80': {}
          },
          Env: this._getEnv(project),
          // Volumes: {
          //   [`${project.name}-config`]: {},
          // },
          NetworkingConfig: {
            EndpointsConfig: {
              web: { Aliases: ["web"] },
            },
          },
        });
        await container.start({});
        this._logger.info("Container", project.name, "created and started");
        await this._removePreviousImage(previousImageId, project.name);
        return container;
      } catch (e) {
        error = e;
        this._logger.error("Impossible to create or start the container, trying one more time", e);
      }
    }
    this._logger.log("Container not created or started after 3 times.");
  }

  private async _removePreviousImage(previousImageId: string, tag: string) {
    const newImageId = (await this._docker.getImage(tag)?.inspect())?.Id;
    if (newImageId !== previousImageId) {
      this._logger.log("Removing previous image for", tag, ":", previousImageId);
      await this._docker.getImage(previousImageId).remove({ force: true });
    }
  }

  /**
   * Start or stop the container from its tag name
   * throw docker error if can't stop or get container from name
   */
  public async toggleContainerFromName(name: string) {
    const container = await this.getContainerFromName(name);
    const containerInfos = await container.inspect();
    containerInfos.State.Running ? await container.stop() : await container.start();
  }

  public async getContainerFromName(projectName: string) {
    return this._docker.getContainer(await this._getContainerIdFromName(projectName));
  }
  public async getContainerNameFromId(id: string) {
    const container = await this._docker.getContainer(id);
    const containerInfos = await container.inspect();
    return containerInfos.Name.replace("/", "");
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

  public async imageExists(name: string): Promise<boolean> {
    try {
      await this._docker.getImage(name).inspect();
      return true;
    } catch (e) { return false; }
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

  private async getImageCommitSha(image: string): Promise<string> {
    const infos = await this._docker.getImage(image).inspect()
    return infos.Config.Labels["herogu.sha"];
  }

  private async _checkStatusEvents(containerId: string) {
    let state: Dockerode.ContainerInspectInfo["State"];
    const handler = this._statusListeners.get(containerId);
    try {
      state = (await this._docker.getContainer(containerId).inspect()).State;
    } catch (e) {
      handler.next([ContainerStatus.NotFound]);
      handler.complete();
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
    if (this._containerIdMap.has(name))
      return this._containerIdMap.get(name);
    const containerName = "/" + name;
    try {
      for (const el of await this._docker.listContainers({ all: true })) {
        if (el.Names.includes(containerName)) {
          this._containerIdMap.set(containerName, el.Id);
          return el.Id;
        }
      }
    } catch (e) {
      if (this._containerIdMap.has(name))
        this._containerIdMap.delete(name);
      this._logger.error(e);
    }
    throw new DockerContainerNotFoundException("No container found with name " + name);
  }

  private async _buildImageFromRemote(url: string, tag: string, lastCommitSha?: string): Promise<void> {
    try {
      const token = await this._github.getInstallationToken(url);
      const mainBranch = await this._github.getMainBranch(url);
      const [owner, repo] = url.split("/").slice(-2);
      lastCommitSha ??= await this._github.getLastCommitSha(url);
      url = `https://x-access-token:${token}@github.com/${owner}/${repo}.git#${mainBranch}`;
      this._logger.log("Building image from remote: " + url);
      const stream = await this._docker.buildImage({ context: ".", src: [] }, {
        t: tag,
        rm: true,
        forcerm: true,
        remote: url,
        dockerfile: "docker/Dockerfile",
        labels: {
          "herogu.sha": lastCommitSha,
        }
      });
      await new Promise<void>((resolve, reject) => {
        stream.on("data", (data) => {
          this._logger.log(data.toString());
        });
        stream.on("error", (e) => {
          reject(e);
        });
        stream.on("end", () => {
          resolve();
        });
      });
    } catch (e) {
      this._logger.error('Error building image from remote: ' + url, e);
      throw new DockerImageBuildException(e, url);
    }
  }

  private _getLabels(name: string): ContainerLabels {
    return {
      "traefik.enable": 'true',
      ...process.env.ENABLE_HTTPS == "true" ? {
        [`traefik.http.routers.${name}-secure.rule`]: `Host(\`${name}${process.env.PROJECT_DOMAIN}\`)`,
        [`traefik.http.routers.${name}-secure.entrypoints`]: "websecure",
        [`traefik.http.routers.${name}-secure.tls.certresolver`]: "myhttpchallenge",
      } : {},
      [`traefik.http.routers.${name}.rule`]: `Host(\`${name}${process.env.PROJECT_DOMAIN}\`)`,
      [`traefik.http.routers.${name}.entrypoints`]: "web",
      [`traefik.http.routers.${name}.middlewares`]: "redirect",
      "traefik.http.middlewares.redirect.redirectscheme.scheme": "https",
      "herogu.enabled": "true",
    };
  }

  private _getEnv(project: Project): string[] {
    return [
      `MYSQL_DATABASE=${project.mysqlInfo?.database}`,
      `MYSQL_USER=${project.mysqlInfo?.user}`,
      `MYSQL_PASSWORD=${project.mysqlInfo?.password}`,
      `MYSQL_HOST=${process.env.MYSQL_HOST}`,
      ...Object.keys(project.phpInfo?.env || {}).map(key => key + "=" + project.phpInfo.env[key])
    ];
  }

  /**
   * Stop and remove container
   */
  private async _removeContainer(id: string, removeVolumes = false) {
    const container = this._docker.getContainer(id);
    const volumes = await this._getContainerVolumes(id);
    try {
      await container.stop();
    } catch (e) {
      this._logger.info("Container cannot stop, trying to remove directly...");
    }
    await container.remove({ force: true });
    if (removeVolumes) {
      for (const volume of volumes) {
        try {
          await volume.remove();
        } catch (e) {
          this._logger.error("Could not remove volume", volume?.name, e);
        }
      }
    }
  }

  private async _getContainerVolumes(id: string): Promise<Dockerode.Volume[]> {
    const container = this._docker.getContainer(id);
    return (await container.inspect()).Mounts.filter(el => el.Name).map(el => this._docker.getVolume(el.Name));
  }

  public async getMysqlContainer() {
    try {
      const mysqlId = (await this._docker.listContainers()).find(el => el.Labels["tag"] == "mysql").Id;
      return this._docker.getContainer(mysqlId);
    } catch (e) {
      this._logger.error("Mysql Container not found");
      throw new NoMysqlContainerException();
    }
  }

  /**
   * Exec a command inside a container
   * @param el the name of the container or the container object
   * @param str the command to execute with its arguments
   * @returns an Observable with the output stream of the command
   */
  public async containerExec(el: string | Dockerode.Container, ...str: string[]): Promise<Observable<string>> {
    this._logger.log(`Exec:${(typeof el === 'string' ? ` [${el}]` : '')} [${str.join(" ")}]`);
    if (typeof el === "string")
      el = await this.getContainerFromName(el);
    const stream = (await (await el.exec({
      Cmd: str,
      AttachStdout: true,
      AttachStderr: true,
      Privileged: true,
      Tty: true
    })).start({
      stdin: true,
      hijack: true
    }));
    return new Observable(subscriber => {
      stream.on("data", (chunk: Buffer) => {
        if (!stream.readable) return;
        // IDK why but the first 8 bytes are always 01 00 00 00 00 00 00 00 and represent nothing
        subscriber.next(chunk.slice(8).toString());
      })
        .on("end", () => subscriber.complete())
        .on("error", (e) => subscriber.error(`Execution error : ${str.join(" ")}, ${e}`));
    });
  }

  public async asyncContainerExec(el: string | Dockerode.Container, ...str: string[]): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let chunks = "";
      const stream = await this.containerExec(el, ...str);
      stream.subscribe({
        next: (chunk: string) => chunks += chunk,
        error: (e) => reject(e),
        complete: () => resolve(chunks)
      });
    })
  }
}
