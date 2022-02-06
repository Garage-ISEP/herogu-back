import { ConfigService } from './../../services/config.service';
import { PhpLogLevelDto } from './project-dashboard.dto';
import { Body, Controller, Delete, Get, Header, InternalServerErrorException, Post, Sse, UseGuards, Patch } from '@nestjs/common';
import { Observable, map, finalize, Subscriber } from 'rxjs';
import { Project } from 'src/database/project.entity';
import { CurrentProject } from 'src/decorators/current-project.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { ProjectGuard } from 'src/guards/project.guard';
import { ContainerStatus } from 'src/models/docker/docker-container.model';
import { ProjectStatusResponse, ProjectStatus } from 'src/models/project.model';
import { DockerService } from 'src/services/docker.service';
import { GithubService } from 'src/services/github.service';
import { MysqlService } from 'src/services/mysql.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { MysqlLinkDto } from '../project/project.dto';
import { MessageEvent } from 'src/models/sse.model';
import { MysqlInfo } from 'src/database/mysql-info.entity';


@Controller('project/:id')
@UseGuards(AuthGuard, ProjectGuard)
export class ProjectDashboardController {

  constructor(
    private readonly _logger: AppLogger,
    private readonly _github: GithubService,
    private readonly _docker: DockerService,
    private readonly _mysql: MysqlService,
    private readonly _config: ConfigService
  ) { }

  private readonly _projectWatchObservables = new Map<string, Subscriber<ProjectStatusResponse>>();

  @Get()
  public async getOne(@CurrentProject() project: Project) {
    return project;
  }

  @Delete()
  @UseGuards(ProjectGuard)
  public async deleteProject(@CurrentProject() project: Project) {
    await this._docker.removeContainerFromName(project.name);
    await this._docker.removeImageFromName(project.name);
    if (project.mysqlInfo)
      await this._mysql.deleteMysqlDB(project.mysqlInfo);
    for (const collab of project.collaborators)
      await collab.remove();
    await project.remove();
    return { success: true };
  }

  @Post('github-link')
  @UseGuards(ProjectGuard)
  public async linkToGithub(@CurrentProject() project: Project) {
    try {
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "github"));
      if (!project.shas || !await this._github.verifyConfiguration(project.githubLink, project.repoId, project.shas)) {
        project.shas = await this._github.addOrUpdateConfiguration(project);
        await project.save();
      }
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.SUCCESS, "github"));
    } catch (e) {
      this._logger.error(e);
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.ERROR, "github"));
      throw new InternalServerErrorException(e.message);
    }
  }

  @Post('docker-link')
  @UseGuards(ProjectGuard)
  public async linkToDocker(@CurrentProject() project: Project) {
    try {
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "docker"));
      await this._docker.launchContainerFromConfig(project);
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.SUCCESS, "docker"));
    } catch (e) {
      this._logger.error(e);
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.ERROR, "docker"));
      throw new InternalServerErrorException(e.message);
    }
  }

  @Post('mysql-link')
  public async linkToMysql(@CurrentProject() project: Project, @Body() body: MysqlLinkDto) {
    try {
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "mysql"));
      await this._mysql.createMysqlDBWithUser(project.mysqlInfo);
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.SUCCESS, "mysql"));
      if (!this._mysql.checkMysqlConnection(project.mysqlInfo.database, project.mysqlInfo.user, project.mysqlInfo.password))
        this._emitProject(project, new ProjectStatusResponse(ProjectStatus.ERROR, "mysql"));
    } catch (e) {
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.ERROR, "mysql"));
      throw new InternalServerErrorException(e.message);
    }
    return await project.save();
  }

  @Post('toggle')
  public async toggleProject(@CurrentProject() project: Project) {
    await this._docker.toggleContainerFromName(project.name);
  }

  @Patch('php-log-level')
  public async updatePhpLogLevel(@CurrentProject() project: Project, @Body() body: PhpLogLevelDto) {
    Object.assign(project.phpInfo, body);
    await project.save();
    await this._config.updatePhpLogLevel(project);
  }

  @Patch('http-root-url')
  public async updateHttpRootUrl(@CurrentProject() project: Project, @Body("httpRootUrl") rootDir: string, @Body("httpRootUrlSha") rootDirSha: string) {
    project.nginxInfo.rootDir = rootDir;
    project.nginxInfo.rootDirSha = rootDirSha;
    await project.save();
    await this._config.updateHttpRootDir(project);
  }

  @Sse('status')
  @Header("Transfer-Encoding", "chunked")
  public getStatus(@CurrentProject() project: Project): Observable<MessageEvent<ProjectStatusResponse>> {
    return new Observable(subscriber => {
      this._projectWatchObservables.set(project.id, subscriber);

      this._mysql.checkMysqlConnection(project.mysqlInfo?.database, project.mysqlInfo?.user, project.mysqlInfo?.password)
        .then(healthy => healthy ? subscriber.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "mysql")) : subscriber.next(new ProjectStatusResponse(ProjectStatus.ERROR, "mysql")));

      this._docker.listenContainerStatus(project.name)
        .then(statusObs => statusObs.subscribe({
          next: status => subscriber.next(new ProjectStatusResponse(status[0], "docker", status[1]))
        }))
        .catch(e => {
          // console.error(e);
          subscriber.next(new ProjectStatusResponse(ContainerStatus.NotFound, "docker"));
          this._logger.log(`Project ${project.name} tried to listen to container status but container not started!`);
        });
      this._docker.imageExists(project.name).then(exists => exists ? subscriber.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "image")) : subscriber.next(new ProjectStatusResponse(ProjectStatus.ERROR, "image")));
    }).pipe(
      map<ProjectStatusResponse, MessageEvent<ProjectStatusResponse>>(response => ({ data: response })),
      finalize(() => this._projectWatchObservables.delete(project.id))
    );
  }

  private _emitProject(project: Project, val: ProjectStatusResponse) {
    this._projectWatchObservables.get(project.id)?.next(val);
  }
}
