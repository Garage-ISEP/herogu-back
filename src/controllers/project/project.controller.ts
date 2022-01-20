import { BadRequestException, Body, Controller, Delete, Get, Header, InternalServerErrorException, Param, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable, Observer, of, Subscriber } from 'rxjs';
import { Collaborator, Role } from 'src/database/collaborator.entity';
import { Project, ProjectType } from 'src/database/project.entity';
import { User } from 'src/database/user.entity';
import { CurrentProject } from 'src/decorators/current-project.decorator';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { DockerService } from 'src/services/docker.service';
import { GithubService } from 'src/services/github.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { CreateProjectDto, MysqlLinkDto } from './project.dto';
import { wait } from 'src/utils/timer.util';
import { ProjectStatus, ProjectStatusResponse } from 'src/models/project.model';
import { ContainerStatus } from 'src/models/docker/docker-container.model';
import { MessageEvent } from 'src/models/sse.model';
import { finalize, map } from 'rxjs/operators';
import UniqueID from 'nodejs-snowflake';

@Controller('project')
@UseGuards(AuthGuard)
export class ProjectController {

  constructor(
    private readonly _logger: AppLogger,
    private readonly _github: GithubService,
    private readonly _docker: DockerService,
  ) { }

  private readonly _projectWatchObservables = new Map<string, Subscriber<ProjectStatusResponse>>();

  @Get("/exists/:name")
  public async projectExists(@Param("name") name: string) {
    this._logger.log(name);
    if (!!await Project.findOne({ where: { name } })) {
      throw new BadRequestException("This project name already exists");
    }
  }

  @Get("/check-bot-github")
  public async checkProjectGithubLink(@Query("link") link: string) {
    return await this._github.verifyInstallation(link);
  }

  @Get('/:id')
  public async getOne(@Param('id') id: string) {
    return await Project.findOne(id, { relations: ["creator", "collaborators"] });
  }

  @Post('/')
  public async createProject(@Body() projectReq: CreateProjectDto, @CurrentUser() user: User) {
    const project = await Project.findOne({ where: { githubLink: projectReq.githubLink.toLowerCase() }, relations: ["creator"] });
    if (project && project.creator.id !== user.id)
      throw new BadRequestException("This repository has already been registered");
    else if (project?.creator?.id === user.id)
      return project;
    const name = projectReq.name.toLowerCase();
    return await Project.create({
      creator: user,
      ...projectReq,
      name,
      githubLink: projectReq.githubLink.toLowerCase(),
      type: projectReq.type == "nginx" ? ProjectType.NGINX : ProjectType.PHP,
      repoId: await this._github.getRepoId(projectReq.githubLink),
      uniqueName: (await new UniqueID().asyncGetUniqueID() as string).substring(0, 6) + "_" + name.substring(0, 10),
      collaborators: [...(await User.find({ where: { studentId: projectReq.addedUsers } })).map(user => Collaborator.create({
        user,
        role: Role.COLLABORATOR
      })), Collaborator.create({ user, role: Role.OWNER })]
    }).save();
  }

  @Delete('/:id')
  public async deleteProject(@CurrentProject() project: Project) {
    const [owner, repo] = project.githubLink.split("/").slice(-2);
    await this._docker.removeContainerFromName(project.uniqueName);
    await this._docker.removeImageFromName(project.uniqueName);
    for (const collab of project.collaborators)
      await collab.remove();
    await project.remove();
  }

  @Post('/:id/github-link')
  public async linkToGithub(@CurrentProject() project: Project) {
    try {
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "github"));
      if (!project.shas || !await this._github.verifyConfiguration(project.githubLink, project.repoId, project.shas)) {
        project.shas = await this._github.addOrUpdateConfiguration(project.githubLink, project.repoId, project.type);
        await project.save();
        await wait(1000);
        await this._github.disableAllWorkflowRuns(project.githubLink, project.repoId);
      }
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "github"));
    } catch (e) {
      this._logger.error(e);
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.ERROR, "github"));
      throw new InternalServerErrorException(e.message);
    }
  }

  @Post('/:id/docker-link')
  public async linkToDocker(@CurrentProject() project: Project) {
    try {
      const [owner, repo] = project.githubLink.split("/").slice(-2);
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "docker"));
      await this._docker.launchContainerFromConfig({
        url: project.githubLink,
        email: project.creator.mail,
        name: project.uniqueName,
        env: project.env,
      });
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "docker"));
    } catch (e) {
      this._logger.error(e);
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.ERROR, "docker"));
      throw new InternalServerErrorException(e.message);
    }
  }

  @Post('/:id/mysql-link')
  public async linkToMysql(@CurrentProject() project: Project, @Body() body: MysqlLinkDto) {
    try {
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.IN_PROGRESS, "mysql"));
      const creds = await this._docker.createMysqlDBWithUser(project.name, body.mysql);
      project.mysqlUser = creds.username;
      project.mysqlPassword = creds.password;
      project.uniqueName = creds.dbName;
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "mysql"));
      if (!this._docker.checkMysqlConnection(project.mysqlUser, project.mysqlPassword, project.uniqueName))
        this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.ERROR, "mysql"));
    } catch (e) {
      this._projectWatchObservables.get(project.id)?.next(new ProjectStatusResponse(ProjectStatus.ERROR, "mysql"));
      throw new InternalServerErrorException(e.message);
    }
    return await project.save();
  }

  @Post('/:id/toggle')
  public async toggleProject(@CurrentProject() project: Project) {
    this._docker.toggleContainerFromName(project.name);
  }

  @Sse('/:id/status')
  @Header("Transfer-Encoding", "chunked")
  public getStatus(@CurrentProject() project: Project): Observable<MessageEvent<ProjectStatusResponse>> {
    return new Observable(subscriber => {
      this._projectWatchObservables.set(project.id, subscriber);

      this._docker.checkMysqlConnection(project.uniqueName, project.mysqlUser, project.mysqlPassword)
        .then(healthy => healthy ? subscriber.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "mysql")) : subscriber.next(new ProjectStatusResponse(ProjectStatus.ERROR, "mysql")));

      this._docker.listenContainerStatus(project.uniqueName)
        .then(statusObs => statusObs.subscribe({
          next: status => subscriber.next(new ProjectStatusResponse(status[0], "docker", status[1]))
        }))
        .catch(e => {
          // console.error(e);
          subscriber.next(new ProjectStatusResponse(ContainerStatus.NotFound, "docker"));
          this._logger.log(`Project ${project.uniqueName} tried to listen to container status but container not started!`);
        });
      this._docker.imageExists(project.uniqueName).then(exists => exists ? subscriber.next(new ProjectStatusResponse(ProjectStatus.SUCCESS, "image")) : subscriber.next(new ProjectStatusResponse(ProjectStatus.ERROR, "image")));
    }).pipe(
      map<ProjectStatusResponse, MessageEvent<ProjectStatusResponse>>(response => ({ data: response })),
      finalize(() => this._projectWatchObservables.delete(project.id))
    );
  }
}
