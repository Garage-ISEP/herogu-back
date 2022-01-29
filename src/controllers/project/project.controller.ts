import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Subscriber } from 'rxjs';
import { Collaborator, Role } from 'src/database/collaborator.entity';
import { Project, ProjectType } from 'src/database/project.entity';
import { User } from 'src/database/user.entity';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { DockerService } from 'src/services/docker.service';
import { GithubService } from 'src/services/github.service';
import { AppLogger } from 'src/utils/app-logger.util';
import { CreateProjectDto } from './project.dto';
import { ProjectStatusResponse } from 'src/models/project.model';
import { MysqlService } from 'src/services/mysql.service';

@Controller('project')
@UseGuards(AuthGuard)
export class ProjectController {

  constructor(
    private readonly _logger: AppLogger,
    private readonly _github: GithubService
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

  @Post('/')
  public async createProject(@Body() projectReq: CreateProjectDto, @CurrentUser() user: User) {
    const project = await Project.findOne({ where: { githubLink: projectReq.githubLink.toLowerCase() }, relations: ["creator"] });
    if (project && project.creator.id !== user.id)
      throw new BadRequestException("This repository has already been registered");
    else if (project?.creator?.id === user.id)
      return project;
    return await Project.create({
      creator: user,
      ...projectReq,
      githubLink: projectReq.githubLink.toLowerCase(),
      type: projectReq.type == "nginx" ? ProjectType.NGINX : ProjectType.PHP,
      repoId: await this._github.getRepoId(projectReq.githubLink),
      collaborators: [...(await User.find({ where: { studentId: projectReq.addedUsers } })).map(user => Collaborator.create({
        user,
        role: Role.COLLABORATOR
      })), Collaborator.create({ user, role: Role.OWNER })]
    }).save();
  }

}
