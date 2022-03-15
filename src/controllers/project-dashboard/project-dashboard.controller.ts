import { ProjectRepository } from 'src/database/project/project.repository';
import { UserRepository } from 'src/database/user/user.repository';
import { Role } from '../../database/collaborator/collaborator.entity';
import { ProjectResponse } from './../../models/project.model';
import { ConfigService } from './../../services/config.service';
import { PhpLogLevelDto } from './project-dashboard.dto';
import { Body, Controller, Delete, Get, Header, InternalServerErrorException, Post, Sse, UseGuards, Patch, BadRequestException } from '@nestjs/common';
import { Observable, map, finalize, Subject, share, refCount } from 'rxjs';
import { Project } from 'src/database/project/project.entity';
import { CurrentProject } from 'src/decorators/current-project.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { ProjectGuard } from 'src/guards/project.guard';
import { ContainerStatus } from 'src/models/docker/docker-container.model';
import { ProjectStatusResponse, ProjectStatus } from 'src/models/project.model';
import { DockerService } from 'src/services/docker.service';
import { GithubService } from 'src/services/github.service';
import { MysqlService } from 'src/services/mysql.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { MessageEvent } from 'src/models/sse.model';
import { SetRole } from 'src/decorators/role.decorator';
import { CollaboratorRepository } from 'src/database/collaborator/collaborator.repository';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { User } from 'src/database/user/user.entity';


@Controller('project/:id')
@UseGuards(AuthGuard, ProjectGuard)
@SetRole(Role.COLLABORATOR, Role.OWNER)   // Default auth role for this controller
export class ProjectDashboardController {

  constructor(
    private readonly _logger: AppLogger,
    private readonly _github: GithubService,
    private readonly _docker: DockerService,
    private readonly _mysql: MysqlService,
    private readonly _config: ConfigService,
    private readonly _collabRepo: CollaboratorRepository,
    private readonly _userRepo: UserRepository,
    private readonly _projectRepo: ProjectRepository,
  ) { }

  private readonly _projectWatchObservables = new Map<string, Subject<ProjectStatusResponse>>();

  @Get()
  public async getOne(@CurrentProject() project: Project) {
    try {
      const containerInfos = await this._docker.getContainerInfosFromName(project.name);
      return new ProjectResponse(project, containerInfos.SizeRw);
    } catch (e) {
      if (e.response?.code == 5)
        return new ProjectResponse(project, 0);
      else
        throw e;
    }
  }

  @Delete()
  public async deleteProject(@CurrentProject() project: Project) {
    await Promise.all([
      (async () => {
        await this._docker.removeContainerFromName(project.name, true);
        await this._docker.removeImageFromName(project.name);
      })(),
      project.mysqlInfo ? this._mysql.deleteMysqlDB(project.mysqlInfo) : Promise.resolve(),
    ]);
    await project.remove();
    return { success: true };
  }

  @Post('github-link')
  public async linkToGithub(@CurrentProject() project: Project) {
    try {
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "github"));
      if (!project.shas || !await this._github.verifyConfiguration(project.githubLink, project.installationId, project.shas)) {
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
  public async linkToDocker(@CurrentProject() project: Project, @CurrentUser() user: User) {
    try {
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "docker"));
      await this._docker.launchContainerFromConfig(project, user.admin);
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.SUCCESS, "docker"));
      const containerInfos = await this._docker.getContainerInfosFromName(project.name);
      return new ProjectResponse(project, containerInfos.SizeRw);
    } catch (e) {
      this._logger.error(e);
      this._emitProject(project, new ProjectStatusResponse(ProjectStatus.ERROR, "docker"));
      throw new InternalServerErrorException(e.message);
    }
  }

  @Post('mysql-link')
  public async linkToMysql(@CurrentProject() project: Project) {
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
    this._emitProject(project, new ProjectStatusResponse(ProjectStatus.SUCCESS, "docker"));
  }

  @Patch('php-log-level')
  public async updatePhpLogLevel(@CurrentProject() project: Project, @Body() body: PhpLogLevelDto) {
    Object.assign(project.phpInfo, body);
    await this._config.updatePhpLogLevel(project);
    await project.save();
  }

  @Patch('http-root-url')
  public async updateHttpRootUrl(@CurrentProject() project: Project, @Body("httpRootUrl") rootDir: string, @Body("httpRootUrlSha") rootDirSha: string) {
    project.nginxInfo.rootDir = rootDir;
    project.nginxInfo.rootDirSha = rootDirSha;
    await this._config.updateHttpRootDir(project);
    await project.save();
  }

  @Patch('env')
  public async updateEnv(@CurrentProject() project: Project, @Body("env") env: { [k: string]: string }) {
    if (project.phpInfo)
      project.phpInfo.env = env;
    await this._docker.launchContainerFromConfig(project, true);
    await project.save();
  }

  @Patch('toggle-notifications')
  public async toggleNotifications(@CurrentProject() project: Project) {
    await this._projectRepo.toggleNotifications(project.id);
    project.notificationsEnabled = !project.notificationsEnabled;
    return project;
  }

  @Patch('user-access')
  @SetRole(Role.OWNER)
  public async updateUserAccess(@CurrentProject() project: Project, @Body("users") userIds: string[]) {
    userIds = await this._userRepo.filterUserList(userIds);
    userIds.push(project.creatorId);
    project.collaborators = await this._collabRepo.updateProjectCollaborators(project, userIds);
    return project;
  }

  @Sse('status')
  @Header("Transfer-Encoding", "chunked")
  public getStatus(@CurrentProject() project: Project): Observable<MessageEvent<ProjectStatusResponse>> {
    // Sometimes the front tries to connect whereas the project is not shown yet (e.g from the menu)
    if (!project) throw new BadRequestException("Project not found");
    let subject: Subject<ProjectStatusResponse>;
    if (this._projectWatchObservables.has(project.id)) {
      this._logger.log("Reusing existing observable for project " + project.name + " to check status");
      subject = this._projectWatchObservables.get(project.id);
    }
    else {
      this._logger.log("Creating new observable for project " + project.name + " to check status");
      subject = new Subject<ProjectStatusResponse>();
      this._projectWatchObservables.set(project.id, subject);
    }

    if (project.mysqlEnabled) {
      this._mysql.checkMysqlConnection(project.mysqlInfo?.database, project.mysqlInfo?.user, project.mysqlInfo?.password)
        .then(healthy => healthy ? subject.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "mysql")) : subject.next(new ProjectStatusResponse(ProjectStatus.ERROR, "mysql")))
        .catch(e => {
          this._logger.error("Mysql verification error", e);
          subject.next(new ProjectStatusResponse(ProjectStatus.ERROR, "mysql"))
        });
    }
    // If it's the first listener we subscribe to the docker event stream status
    // Or if there is a new docker event stream due to docker container re-creation
    if (!this._docker.isListeningStatus(project.name) || !subject.observed) {
      try {
        const statusObserver = this._docker.listenContainerStatus(project.name);
        statusObserver.subscribe(status => {
          subject.next(new ProjectStatusResponse(status[0], "docker", status[1]));
        });
      } catch (e) {
        subject.next(new ProjectStatusResponse(ContainerStatus.NotFound, "docker"));
        this._logger.log(`Project ${project.name} tried to listen to container status but container not started!`);
      }
    } else { // If it's not the first time we just re-emit current status so the new client can get it
      this._docker.emitContainerStatus(project.name).catch(e => {
        console.error(e);
        subject.error("Error while emitting container status");
      });
    }

    this._docker.imageExists(project.name)
      .then(exists => exists ? subject.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "image")) : subject.next(new ProjectStatusResponse(ProjectStatus.ERROR, "image")))
      .catch(e => {
        this._logger.error("Image verification error", e);
        subject.next(new ProjectStatusResponse(ProjectStatus.ERROR, "image"));
      });
    return subject.pipe(
      map<ProjectStatusResponse, MessageEvent<ProjectStatusResponse>>(response => ({ data: response })),
      finalize(() => {
        this._logger.log("Client observer unsubscribed from project status", project.name);
        if (!subject.observed) {
          subject.complete();
          this._docker.stopListeningContainerStatus(project.name);
          this._projectWatchObservables.delete(project.id);
          this._logger.log("Observable closed for project " + project.name);
        }
      })
    )
  }

  private _emitProject(project: Project, val: ProjectStatusResponse) {
    this._projectWatchObservables.get(project.id)?.next(val);
  }
}
