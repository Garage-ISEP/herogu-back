import { BadRequestException, Body, Controller, Get, InternalServerErrorException, Param, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { from } from 'form-data';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Collaborator, Role } from 'src/database/collaborator.entity';
import { Project, ProjectType } from 'src/database/project.entity';
import { User } from 'src/database/user.entity';
import { CurrentProject } from 'src/decorators/current-project.decorator';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { DockerService } from 'src/services/docker.service';
import { GithubService } from 'src/services/github.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { CreateProjectDto, DockerLinkDto, GithubLinkDto, MysqlLinkDto } from './project.dto';
import { MessageEvent } from "src/models/sse.model";

@Controller('project')
@UseGuards(AuthGuard)
export class ProjectController {

  constructor(
    private readonly _logger: AppLogger,
    private readonly _github: GithubService,
    private readonly _docker: DockerService,
  ) { }

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
    const project = await Project.findOne({ where: { githubLink: projectReq.githubLink, name: projectReq.name }, relations: ["creator"] });
    if (project && project.creator.id !== user.id)
      throw new BadRequestException("This repository has already been registered");
    else if (project?.creator?.id === user.id)
      return project;
    return await Project.create({
      creator: user,
      ...projectReq,
      type: projectReq.type == "nginx" ? ProjectType.NGINX : ProjectType.PHP,
      collaborators: [...(await User.find({ where: { studentId: projectReq.addedUsers } })).map(user => Collaborator.create({
        user,
        role: Role.COLLABORATOR
      })), Collaborator.create({ user, role: Role.OWNER })]
    }).save();
  }

  @Post('/:id/github-link')
  public async linkToGithub(@CurrentProject() project: Project, @Body() body: GithubLinkDto) {
    try {
      project.repoId ??= await this._github.getRepoId(project.githubLink);
      project.shas = await this._github.addOrUpdateConfiguration(project.githubLink, project.repoId, project.type, body.accessToken);
    } catch (e) {
      this._logger.error(e);
      throw new InternalServerErrorException(e.message);
    }
    await project.save();
  }

  @Sse("/:id/building-link")
  public async buildLink(@CurrentProject() project: Project): Promise<Observable<MessageEvent>> {
    try {
      return (await this._github.getBuildingActionStatus(project.name)).pipe(map(status => ({
        data: status
      })));
    } catch (e) {
      this._logger.error(e);
      throw new InternalServerErrorException("Could not get build action status with github");
    }
  }

  @Post('/:id/docker-link')
  public async linkToDocker(@CurrentProject() project: Project, @Body() body: DockerLinkDto) {
    try {
      await this._docker.launchContainerFromConfig({ url: project.githubLink, email: project.creator.mail, name: project.name, ...body });
      project.env = body.env || {};
      project.save();
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
    await project.save();
  }

  @Post('/:id/mysql-link')
  public async linkToMysql(@CurrentProject() project: Project, @Body() body: MysqlLinkDto) {
    try {
      const creds = await this._docker.createMysqlDBWithUser(project.name, body.mysql);
      project.mysqlUser = creds.username;
      project.mysqlPassword = creds.password;
      project.mysqlDatabase = creds.dbName;
    } catch (e) {
      throw e;
    }
    await project.save();
  }
}
